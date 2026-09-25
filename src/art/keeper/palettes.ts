// The keepers' colours (docs/KEEPERS.md 3): one palette per keeper, in the engine's Palette shape so the humanoid rig's
// default parts (drawLimbSegs, drawFist, drawSkull) colour from it as they do in the sibling games, plus the slots
// only a keeper's own parts read (an apron, a hat, a tool).
//
// Like the dragons' palettes, every value here is measured, never eyeballed: tools/palette-check.ts runs the keeper
// gates (its KEEPERS section) on these exact hexes -- the house ladder between every pair of colours that touch on the
// sprite, the far side against the near side and against the ink, the shoes and trousers against the straw floor, and
// the four keepers told apart in normal vision and both dichromacies. Change a hex here and re-run `npm run palette`.
//
// Slot roles for a keeper (the engine's names, with what they paint on a person):
//   skin      face, neck, forearms (short sleeves) and hands
//   hair      hair, brows and a beard
//   primary   the top: blouse, shirt, cardigan, tee (and a long sleeve's forearm)
//   sleeve    the upper arm; the engine fills it from primary when absent
//   secondary trousers, skirt, overalls
//   accent    a small trim: the hat band, a cardigan's buttons, the overall buckles
//   metal     worked metal on a tool (the brush's ferrule)
//   dark      shoes
//   glow      the blush on a happy face (drawn flat, 3 x 2 under the near eye)
import type { Palette } from '../../lib/art/palettes.ts';
import type { KeeperId } from './cast.ts';

/** A keeper's colours: the engine's eight slots plus the keeper-only parts (absent where a keeper has none). */
export interface KeeperPalette extends Palette {
  /** Bea's apron (bib and skirt, one inked panel each): the cook's tell. */
  apron?: string;
  /** Tomas's straw hat, Iris's nightcap. */
  hat?: string;
  /** Iris's pom-pom and the nightcap's cuff, Pip's overall straps. */
  trim?: string;
  /** The tool a keeper carries (the brush's wooden back; the bowl keeps its own clay colours: props.ts). */
  tool?: string;
}

/** Shared keeper colours, the dragons' shared ones where the two meet (DRAGON_SHARED: the ink, the eye whites). */
export const KEEPER_SHARED = Object.freeze({
  /** The house outline. */
  outline: '#1a1018',
  /** Eye whites (the engine's drawFace white) and the catchlight white. */
  white: '#f8f4ec',
  /** Pupils, the engine's drawFace near-black. */
  pupil: '#1a1418',
  /** Ground shadow, as the dragons': the ink at alpha 0.28. */
  groundShadow: 'rgba(26,16,24,0.28)',
});

/**
 * The four keepers' palettes. Chosen so each keeper's TOP is a different hue family and value (terracotta, denim,
 * mauve, leaf green), their skin tones span light to deep, and the three things a care act puts in contact read
 * apart: a hand on its tool, a forearm over the shirt, and the shoes on the straw.
 */
export const KEEPER_PALETTES: Readonly<Record<KeeperId, Readonly<KeeperPalette>>> = Object.freeze({
  // Bea, the cook (an elder): silver hair in a bun, a terracotta blouse under a cream apron, plum skirt, brown shoes.
  // Her skin is a warm mid-brown, so her silver hair clears it by value (58 %) and her hands clear the clay bowl. Her
  // blush is a raspberry rose: a coral one sat 8 % and 25 deg from her skin, and vanished.
  bea: Object.freeze({
    skin: '#c68a5e', hair: '#dcdfe4', primary: '#b04e3a', secondary: '#5e4262', accent: '#e8c46a',
    metal: '#c8c4bc', dark: '#6a4636', glow: '#e8508a', apron: '#f2e7c9',
  }),
  // Tomas, the groomer: a weathered-straw hat with an oxblood band, a dark beard, a denim work shirt with the sleeves
  // rolled, brown trousers and boots, a wooden grooming brush. (The denim a shade darker than a chambray: at the
  // value of Iris's mauve cardigan the two tops merged under deuteranopia.)
  tomas: Object.freeze({
    skin: '#f0c29c', hair: '#4a3326', primary: '#3d5f94', secondary: '#6e4f37', accent: '#6e2e2a',
    metal: '#c8c4bc', dark: '#5c3e30', glow: '#f08a8a', hat: '#b98a3a', tool: '#9a6a3c',
  }),
  // Iris, the night keeper: a periwinkle nightcap with a cream pom-pom, a mauve cardigan over a cream nightshirt, slate
  // trousers and rose slippers (the slippers are the one light shoe: 40 % from the straw).
  iris: Object.freeze({
    skin: '#7a4e34', hair: '#2b2231', primary: '#b3637d', secondary: '#3f4c6a', accent: '#f4ecd8',
    metal: '#c8c4bc', dark: '#d89aa0', glow: '#d9607a', hat: '#6a86cc', trim: '#f4ecd8',
  }),
  // Pip, the apprentice (a child): ginger tufts, a leaf-green tee, denim overalls, red sneakers.
  pip: Object.freeze({
    skin: '#eab488', hair: '#c9602c', primary: '#78b84a', secondary: '#4f71ab', accent: '#e8c46a',
    metal: '#c8c4bc', dark: '#c23b3b', glow: '#f07a7a', trim: '#4f71ab',
  }),
});

/**
 * Hand-set skin shadows (the dragons' DRAGON_SHADOW precedent, rock's warm shadows): the engine's toneOf turns a
 * shadow cooler, which on skin is a mauve-grey (Tomas's `#9e8682`), and across the lower face it read as stubble or
 * a smudge. A warm, redder step reads as the underside of a face. rig.ts seeds the skin's tone ramp with it; the
 * palette check holds it >= 25 % under its base (gate d).
 */
export const KEEPER_SKIN_SHADOW: Readonly<Record<KeeperId, string>> = Object.freeze({
  bea: '#9c6444', tomas: '#d4946c', iris: '#583424', pip: '#cc8a62',
});

/**
 * The far side: the engine's darkening (rig.ts FAR_SHADE 0.62) with half its desaturation (0.12 against 0.25): at the
 * engine's 0.25 a far hand in light skin went grey-brown (`#8f7a6e`) and read as a stain on the trousers. Still
 * ~62 % under the near side; the palette check gates it (far vs near >= 25 %, far vs ink >= 25 % and >= 6 Oklab L).
 */
export const KEEPER_FAR = Object.freeze({ shade: 0.62, desat: 0.12 });
