// The element registry: the six ElementSpecs in bible order (docs/ART_BIBLE.md section 3). Each element artist owns
// exactly one of the files imported here; this index only lists them.
import type { DragonElement } from '../palettes.ts';
import type { ElementSpec } from '../element.ts';
import { FIRE } from './fire.ts';
import { SPIKE } from './spike.ts';
import { ROCK } from './rock.ts';
import { LIGHTNING } from './lightning.ts';
import { WATER } from './water.ts';
import { SLINKWING } from './slinkwing.ts';

/** Element ids in bible order: fire, spike, rock, lightning, water, slinkwing. */
export const ELEMENT_IDS: readonly DragonElement[] = ['fire', 'spike', 'rock', 'lightning', 'water', 'slinkwing'];

/** Every element's spec by id. */
export const ELEMENTS: Readonly<Record<DragonElement, ElementSpec>> = Object.freeze({
  fire: FIRE, spike: SPIKE, rock: ROCK, lightning: LIGHTNING, water: WATER, slinkwing: SLINKWING,
});
