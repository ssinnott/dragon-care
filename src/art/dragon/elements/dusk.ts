// DUSK: "Wisp", the lamplighter (docs/ART_BIBLE.md 3.8), the seventh element (v2). Zone: ahead of the face. Cue: a
// crook lamp, a thin stalk from the brow arching forward to a round lantern hung ahead of the snout.
//
// FIRST PASS: placeholder until the element pass. This file only exists so the seventh element builds, draws and
// passes the audits with its palette (palettes.ts DRAGON_PALETTES.dusk), its 2.3 build and the shared features
// the bible gives it (moth-grey bat wings with soft convex lobes, no horns, thin flat legs, a drooping tail, a grey
// smoke band at the tail tip standing in for the `tip` marking kind). It draws NO renderer of its own: none of the
// lamp (nearHead), the Nightfall mist (breath), the moth and the lamp's breathing (ambient), the nose frost
// (headMarkings), the lamp-bat fidget or the 4.3 column exist yet -- they are the element artist's, from 3.8.
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
  name: 'Wisp',
  blurb: 'Gentle, dreamy and a little shy. It lights its lamp at dusk and likes to be tucked in at bedtime.',
  palette: PAL,
  // 3.8's build: a little deep, light-footed on thin flat legs (x 0.76: the adult hind root 4.9 px, under FLAT_R, so
  // no shadow band a far leg would have to clear: D8, E4), a raised neck, a long trailing tail. Body length 1.0, not
  // the prototype's compact 0.95: at 0.95 the baby walk's far front root lay 0.2 px inside the chest (the leg-root
  // audit wants 0.25; 5.1 #5); at 1.0 it keeps 0.9
  modifiers: {
    bodyLength: 1.0, bodyDepth: 1.05, legLength: 0.95, legR: 0.76, neckLength: 1.15, neckAngle: 12, tailLength: 1.1,
    tailR: 0.85, snout: 0.9,
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
