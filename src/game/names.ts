// Hatchlings' names (plan S5): each element has six of its own, and a baby takes the first of its element's that no
// dragon has -- in the barn, the garden or away (every dragon the world has) -- else one of them with a number: CINDER2,
// ASH2, ..., CINDER3. No randomness (a name is the world's to pick, the same in every run), and never over NAME_MAX
// characters (the job strip's chips and the dragon card are sized for it).
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { CareSim } from './sim.ts';

/** A name's most characters. */
export const NAME_MAX = 8;

/** Each element's hatchlings' names, in the order they are given. */
export const NAMES: Readonly<Record<DragonElement, readonly string[]>> = Object.freeze({
  fire: Object.freeze(['CINDER', 'ASH', 'FLINT', 'SPARK', 'BLAZE', 'SOOT']),
  spike: Object.freeze(['BURR', 'THISTLE', 'QUILL', 'BRIAR', 'NETTLE', 'TEASEL']),
  rock: Object.freeze(['PEBBLE', 'SHALE', 'GRAVEL', 'SLATE', 'GARNET', 'CAIRN']),
  lightning: Object.freeze(['BOLT', 'VOLT', 'FIZZ', 'STATIC', 'FLICKER', 'JOLT']),
  water: Object.freeze(['SPLASH', 'BROOK', 'DRIZZLE', 'EDDY', 'TIDE', 'MISTY']),
  slinkwing: Object.freeze(['FLIT', 'WHISPER', 'HUSH', 'DART', 'SWOOP', 'MOTH']),
  dusk: Object.freeze(['GLOAM', 'NOX', 'LANTERN', 'DIM', 'VESPER', 'TWILIT']),
});

/**
 * The name a new baby of this element takes: the first of NAMES[el] no dragon in the world has; else, from 2 up, each
 * of them in turn with the number (cut short to keep within NAME_MAX), the first that none has.
 */
export function hatchName(sim: CareSim, el: DragonElement): string {
  const used = new Set(sim.dragons.map((d) => d.name));
  for (const n of NAMES[el]) if (!used.has(n)) return n;
  for (let k = 2; ; k++) {
    const s = String(k);
    for (const n of NAMES[el]) { const name = n.slice(0, NAME_MAX - s.length) + s; if (!used.has(name)) return name; }
  }
}
