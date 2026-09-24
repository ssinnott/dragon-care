// DUSK: "Wick", the lamplighter (docs/ART_BIBLE.md 3.8), the seventh element (v2; nickname and element name to be
// confirmed by the user). Zone: ahead of the face. Cue: a crook lamp, a thin stalk from the brow arching forward to a
// small lantern (taller than wide, capped, hung by a bail) ahead of the snout.
//
// FIRST PASS: placeholder until the element pass. This file only exists so the seventh element builds, draws and
// passes the audits with its palette (palettes.ts DRAGON_PALETTES.dusk), its 2.3 build and the shared features
// the bible gives it (moth-grey bat wings with soft convex lobes, no horns, thin flat legs on a deep, soft body, a
// long drooping tail, a grey smoke band at the tail tip standing in for the stepped `tip` marking). It draws NO
// renderer of its own: none of the lamp (nearHead), the Nightfall mist (breath), the moth and the lamp's breathing
// (ambient), the nose frost (headMarkings), the lamp-bat fidget or the 4.3 column exist yet -- they are the element
// artist's, from 3.8.
import { DRAGON_PALETTES } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, MarkingSpec } from '../element.ts';

const PAL = DRAGON_PALETTES.dusk;

/**
 * FIRST PASS stand-in for the smoke tail tip (3.8: a `tip` marking, pigment from the tail's tip back 6 / 10 / 14 /
 * 22 px): a wide `ring` fitted out toward the tip. The tip kind replaces it in the element pass.
 */
const smokeTip = (t: number, size: number): MarkingSpec => ({ kind: 'ring', at: 'tail', t, size });

export const DUSK: ElementSpec = {
  id: 'dusk',
  name: 'Wick',
  blurb: 'Gentle, dreamy and sleepy: the early sleeper. It carries its lamp into the evening and likes to be tucked in at bedtime.',
  palette: PAL,
  // 3.8's build (v2, after the care review: its first build was slinkwing's in six of eight columns): soft and
  // sleepy, a deep round body (1.2) low on short legs (0.85), thin and flat (x 0.76: the adult hind root under FLAT_R,
  // so no shadow band a far leg would have to clear: D8, E4), a short soft snout (0.8), a plain neck carried a little
  // up (+6 deg: the stargazing +12 read proud and alert), a long, full, drooping tail (1.2, r 1.0) trailing like
  // smoke. Body length 1.0: at 0.95 the baby walk's far front root lay 0.2 px inside the chest (the leg-root audit
  // wants 0.25; 5.1 #5)
  modifiers: {
    bodyLength: 1.0, bodyDepth: 1.2, legLength: 0.85, legR: 0.76, neckLength: 1.0, neckAngle: 6, tailLength: 1.2,
    tailR: 1.0, snout: 0.8,
  },
  stages: {
    baby: {
      tailRest: TAIL_REST.dusk.baby, horns: null, markings: [smokeTip(0.62, 5)],
      wing: wingParams({ style: 'bat' }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.dusk.young, horns: null, markings: [smokeTip(0.8, 8)],
      wing: wingParams({ style: 'bat', scallop: -1 }), dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.dusk.adult, horns: null, markings: [smokeTip(0.8, 11)],
      wing: wingParams({ style: 'bat', scallop: -1.5 }), dorsal: null,
    },
  },
  render: {},
};
