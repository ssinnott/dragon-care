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
// ground ticks (a planted paw must hold still against them). The keepers too (docs/KEEPERS.md): the cast in every anim,
// strips of the care acts, the yard, and the care audits. Every shot is frozen-time, so the set is deterministic.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIM_NAMES, idleVariants } from '../src/art/dragon/anims.ts';
import { STAGES } from '../src/art/dragon/stages.ts';
import { ELEMENTS, ELEMENT_IDS } from '../src/art/dragon/elements/index.ts';
import { KEEPER_ANIM_NAMES, KEEPER_ONE_SHOTS } from '../src/art/keeper/anims.ts';

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
  // the crowd in the mix at a later frame, and in greyscale and deuteranopia (5.4: the overlaps separate in all three)
  'shots/habitat_mix200.png=view=habitat&anim=mix&t=200',
  'shots/habitat_mix200_grey.png=view=habitat&anim=mix&t=200&post=grey',
  'shots/habitat_mix200_cvd.png=view=habitat&anim=mix&t=200&post=cvd',
  'shots/lineup_walk.png=view=lineup&anim=walk&t=10',
  'shots/lineup_sleep.png=view=lineup&anim=sleep&t=10',
  ...ELEMENT_IDS.map((el) => `shots/stages_${el}.png=view=stages&el=${el}&t=0`),
  // review extras: the mood gauge (D7) and the pixel-zoom cast per stage
  ...STAGES.map((st) => `shots/mood_${st}.png=view=mood&stage=${st}&t=0&scale=1`),
  ...STAGES.map((st) => `shots/cast_${st}.png=view=cast&stage=${st}&t=0&scale=1`),
  // the elders' wing wear (2.9): the hole at full spread and at home (the airing), the tears in the preen
  'shots/wings_elder.png=view=wings&t=0',
  // the base (docs/BASE_DESIGN.md): its first seconds (the start camera: the barn's west half, the lift, ZAP boarding
  // the car at the upper floor; and the east half), a minute of care (the dragons walked to their needs' rooms), a
  // ride (EMBER on the Dragon Lift's car between the upper floor and the hayloft, on its way to the Lamp Dorm), every
  // stage at once (the ages preset), and the roof: the Aerie deck, its gantry, the lift's shaft and headframe
  'shots/base_t600.png=view=base&t=600',
  'shots/base_t600_east.png=view=base&t=600&cam=560,376',
  'shots/base_t3600.png=view=base&t=3600',
  'shots/base_lift.png=view=base&t=1100&cam=328,300',
  'shots/base_ages.png=view=base&preset=ages&t=60',
  'shots/base_aerie.png=view=base&t=60&cam=0,0',
  // the time of day (7): the start frame at night, at dusk and at dawn (t=600 is an hour and twenty minutes on from the
  // hour: 23:20, 19:20, 06:20) -- the dragons' pixels the same as base_t600's; night in the sky, the windows, the lamps
  // and the moonlit walls and shell (plan S6c: the building's night colours, never a dragon's or a floor's), all the way
  // at 19:20, gone again by 06:20 -- the dusk's and the dawn's turns a step at a time (18:20: the walls a third of the
  // way to night, the lamps' inner ring; 05:20: two thirds), the cast alone at night on a flat colour (layers=cast: the
  // no-tint check's picture), and the night seen outside: the sky over the roof (the stars, the moon's blue hour, the
  // skylight, the dorm lamp's rings) and the west tower's lit slits by the hearth's glow
  'shots/base_night.png=view=base&t=600&hour=22',
  'shots/base_dusk.png=view=base&t=600&hour=18',
  'shots/base_dawn.png=view=base&t=600&hour=5',
  'shots/base_dusk_turn.png=view=base&t=600&hour=17',
  'shots/base_dawn_turn.png=view=base&t=600&hour=4',
  'shots/base_night_cast.png=view=base&t=600&hour=22&layers=cast',
  'shots/base_night_roof.png=view=base&t=600&hour=22&cam=300,100',
  'shots/base_night_west.png=view=base&t=600&hour=22&cam=0,300',
  // growing up and eggs (7; plan S5): EMBER six steps into its grow-up (the new elder's silhouette flat in its glow's
  // highlight inside its own ink, the toast), the Hatchery's three eggs (a rock egg just laid, a dusk one with its first
  // crack, a water one with two and its wobble), and a hatch (CINDER standing up in the first nest, its shell's bits
  // flying)
  'shots/base_growup.png=view=base&preset=growup&t=36',
  'shots/base_hatchery.png=view=base&preset=eggs&t=600&cam=872,376',
  'shots/base_hatch.png=view=base&preset=hatch&t=70&cam=872,376',
  // the Hatchery with a hatchling at home: the eggs preset's water egg hatched (step 2160) into SPLASH, standing in front
  // of its own nest, now empty, with the rock and dusk eggs still in view in theirs
  'shots/base_hatchery_home.png=view=base&preset=eggs&t=2230&cam=872,376',
  // the elder garden (plan S6): the garden preset's three residents on their plots past the Garden Gate, by day (sitting
  // and napping by their nest mounds, the hedge, the apple trees, the lanterns, the pale path underfoot) and at night
  // (napping, the lanterns' rings on the hedge, the hedge, lawn, trees and fence moonlit, the path the same); and the retire preset's first elder under the gate's arch, walking out
  // (step 2564: npm run sim section 15)
  'shots/base_garden.png=view=base&preset=garden&cam=1304,376&t=600',
  'shots/base_garden_night.png=view=base&preset=garden&cam=1304,376&t=600&hour=22',
  'shots/base_gate.png=view=base&preset=retire&cam=1060,376&t=2564',
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
  // every elder's airing (4.2): the one spread at idle, the hole seen at home (rock's is its sunning, lightning's its
  // storm-watch)
  if (idleVariants('elder', ELEMENTS[el].stages.elder.wing).includes('airing')) pairs.push(`shots/airing_${el}_elder.png=view=strip&el=${el}&stage=elder&anim=airing&n=8&t=0`);
}
// the element anims past the shared table (fire's bath, rock's upset tuck, slinkwing's lonely call), young and adult
for (const [el, anim] of [['fire', 'bath'], ['rock', 'upset'], ['slinkwing', 'call']] as const) {
  for (const stage of ['adult', 'young']) pairs.push(`shots/element_${el}_${stage}_${anim}.png=view=strip&el=${el}&stage=${stage}&anim=${anim}&n=8&t=0`);
}
// the floor audit (5.1 #14: every look, every anim; failing runs show their worst frame), the leg-root audit (1.2),
// the tail-ceiling and pour-column audits (3.0, 3.8) and the face sheets
pairs.push('shots/floor.png=view=floor&t=0', 'shots/roots.png=view=roots&t=0', 'shots/tails.png=view=tails&t=0', 'shots/pour.png=view=pour&t=0');
for (const st of STAGES) pairs.push(`shots/faces_${st}.png=view=faces&stage=${st}&t=0`);
// the breath stream of every element (adult sustain) and the six baby fizzles
for (const el of ELEMENT_IDS) {
  pairs.push(`shots/breath_${el}_adult.png=view=strip&el=${el}&stage=adult&anim=breath&n=6&from=20&span=36&t=0`);
  pairs.push(`shots/breath_${el}_elder.png=view=strip&el=${el}&stage=elder&anim=breath&n=6&from=24&span=48&t=0`);
  pairs.push(`shots/breath_${el}_baby.png=view=strip&el=${el}&stage=baby&anim=breath&n=6&t=0&scale=3`);
}
// Nightfall whole (3.8): the puffs, the band under the lamp, the settle and the bank, adult and elder (its ring)
pairs.push('shots/breath_dusk_adult_whole.png=view=strip&el=dusk&stage=adult&anim=breath&n=12&from=18&span=96&t=0');
pairs.push('shots/breath_dusk_elder_whole.png=view=strip&el=dusk&stage=elder&anim=breath&n=12&from=22&span=92&t=0');

// the keepers (docs/KEEPERS.md): the cast in every anim (the one-shots mid-play), the care acts -- each on a baby and a
// grown dragon, as 12-frame strips -- the yard at three moments, and the two care audits
for (const anim of KEEPER_ANIM_NAMES) pairs.push(`shots/keepers_${anim}.png=view=keepers&anim=${anim}&t=${KEEPER_ONE_SHOTS.includes(anim) ? 20 : 0}&scale=1`);
pairs.push('shots/care.png=view=care&t=300&scale=1');
for (const [act, k, el, st] of [
  ['feed', 'bea', 'fire', 'baby'], ['feed', 'bea', 'water', 'adult'], ['pet', 'tomas', 'spike', 'adult'], ['pet', 'tomas', 'rock', 'baby'],
  ['pet', 'pip', 'slinkwing', 'baby'], ['pet', 'bea', 'fire', 'adult'], ['tuck', 'iris', 'dusk', 'adult'], ['tuck', 'iris', 'lightning', 'baby'],
] as const) pairs.push(`shots/care_${act}_${k}_${el}_${st}.png=view=care&act=${act}&k=${k}&el=${el}&stage=${st}&n=12&span=1100&t=0&scale=1`);
for (const t of [300, 900, 1800]) pairs.push(`shots/yard_t${t}.png=view=yard&t=${t}`);
pairs.push('shots/careaudit.png=view=careaudit&t=0', 'shots/yardaudit.png=view=yardaudit&t=0');

const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'shot.ts'), ...pairs, '--scale', scale], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status ?? 1);
