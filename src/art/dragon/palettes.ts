// Dragon Care palettes: the 6 elements x 8 slots that colour all 18 dragon looks (docs/ART_BIBLE.md section 3).
//
// One palette per ELEMENT, never per life stage: a baby, its young-adult self and its adult self use the same
// eight hexes, which is half of why they read as one species (the other half is the cue in the same place).
// The rig imports these values and tools/palette-check.ts measures them. Change a hex here and re-run
// `node tools/palette-check.ts` before anything is drawn with it, because the check is what keeps the values honest.
//
// Slot roles (where each colour is painted) are in the DragonPalette comments. Derived tones (shadow, highlight,
// rim, deep) are NOT stored: they come from the engine's makeTones / toneOf ramp, and far-side colours from
// farPalette with DRAGON_FAR, so a ramp or far-shade change reaches every dragon at once.
import { mix } from '../../lib/art/palettes.ts';
import type { ColorMap } from '../../lib/art/palettes.ts';
import { makeTones } from '../../lib/art/shading.ts';

/** The six elements, in roster order. */
export const DRAGON_ELEMENTS = ['fire', 'spike', 'rock', 'lightning', 'water', 'shriekscale'] as const;
export type DragonElement = typeof DRAGON_ELEMENTS[number];

/**
 * One element's colours. It extends the engine's `ColorMap` so `farPalette` / `shadePalette` accept it as-is,
 * and it holds no other key: the rig adapts these slots to the engine's `Palette` names when it needs
 * `drawLimbSegs` (skin = primary = secondary = scale, hair = marking, accent = metal = horn).
 */
export interface DragonPalette extends ColorMap {
  /** Body, neck, head, legs, paws, tail, wing arm and finger spars: the element's body colour. */
  scale: string;
  /**
   * Underside stripe, continuous from chin to throat to belly to tail underside; jaw underside. It is the bottom edge
   * of the silhouette, seen against the habitat floor, so it is gated against the floor too (palette-check gate i).
   */
  belly: string;
  /**
   * Wing membrane, plus the element's skin features: water's fluke and fins, shriekscale's ear-fans, throat sac and
   * sound arcs. Also the 1 px ring on water's bubbles and drips.
   */
  membrane: string;
  /** Horns, claws (drawn un-inked), spike quills, shriekscale fan ribs, water fin rays. */
  horn: string;
  /** Element markings: flame-licks, tail rings, rock's dome carapace, bolt stripes, pearl spots, shriekscale's eye mask. */
  marking: string;
  /** Nostrils (2 x 2). The quill and claw tips it once coloured were dropped: at 2 px they were under the mark floor. */
  dark: string;
  /** The one saturated signal colour: flame, sap, crystals, sparks, glow spots, note glyphs. Drawn flat, never banded. */
  glow: string;
  /** Iris. Drawn flat inside a 1 px ink ring, so it never needs to separate from the scale. */
  eye: string;
}

/** The eight slot names, in table order. */
export type DragonSlot = 'scale' | 'belly' | 'membrane' | 'horn' | 'marking' | 'dark' | 'glow' | 'eye';
export const DRAGON_SLOTS: readonly DragonSlot[] = ['scale', 'belly', 'membrane', 'horn', 'marking', 'dark', 'glow', 'eye'];

/** The palette table. Every value is validated by tools/palette-check.ts; see its report in docs/ART_BIBLE.md. */
export const DRAGON_PALETTES: Readonly<Record<DragonElement, Readonly<DragonPalette>>> = Object.freeze({
  fire: Object.freeze({
    scale: '#f04422', belly: '#e08a2c', membrane: '#7f1e3a', horn: '#734a4c',
    marking: '#ffe29a', dark: '#2b1418', glow: '#ffa21f', eye: '#ffc02e',
  }),
  spike: Object.freeze({
    scale: '#2f8232', belly: '#a3ad55', membrane: '#2e6b58', horn: '#f2e8c6',
    marking: '#173a19', dark: '#4a2618', glow: '#7dff8c', eye: '#ff9a3c',
  }),
  rock: Object.freeze({
    scale: '#cfb788', belly: '#fff7e2', membrane: '#4c5670', horn: '#5e4e46',
    marking: '#7e5f44', dark: '#3b2c24', glow: '#b48cff', eye: '#ffb84a',
  }),
  lightning: Object.freeze({
    scale: '#2d58cc', belly: '#9fb4f2', membrane: '#ffcf33', horn: '#404a9c',
    marking: '#ffcf33', dark: '#141a3c', glow: '#fff6a0', eye: '#ffc41f',
  }),
  water: Object.freeze({
    scale: '#20a3ce', belly: '#85c6ae', membrane: '#1e5f8c', horn: '#eaf6f0',
    marking: '#dcfff6', dark: '#0e2a36', glow: '#40d8f0', eye: '#ffc64a',
  }),
  shriekscale: Object.freeze({
    scale: '#5a2f6e', belly: '#fff5f8', membrane: '#ff6fae', horn: '#f0dce6',
    marking: '#9a6aa8', dark: '#2e1638', glow: '#ff9ed2', eye: '#3fe0a0',
  }),
});

/** Colours the whole family shares, never per element. */
export const DRAGON_SHARED = Object.freeze({
  /** The house outline (shading.ts / rig.ts default). */
  outline: '#1a1018',
  /** Pupil, the same near-black the engine's drawFace uses. */
  pupil: '#1a1418',
  /** 2x2 catchlight, egg tooth and fangs. */
  catchlight: '#f8f4ec',
  /** Open-mouth interior. */
  mouth: '#5a2030',
  /** Tongue (2x2 minimum). */
  tongue: '#f07890',
  /** Cheek blush on the happy / chew / pet faces: an opaque 3x2 (baby 4x2) under and behind the eye. */
  blush: '#ff9ab0',
  /** Ground-shadow ellipse: the outline at alpha 0.28, flat. */
  groundShadow: 'rgba(26,16,24,0.28)',
});

/**
 * Per-element blush, where the shared `DRAGON_SHARED.blush` fails (palette-check gates a and f).
 * rock : its sandstone sits 3 % in luminance from the shared pink and passed only on hue, which does not survive
 *        deuteranopia or protanopia. `#d8607a` would fail on fire (7 %), so it is an override, not a new shared value.
 * water: under protanopia the shared pink lands 13 % from the cyan scale; a paler pink clears it.
 */
export const DRAGON_BLUSH: Readonly<Partial<Record<DragonElement, string>>> = Object.freeze({ rock: '#d8607a', water: '#feaebe' });
/** The blush an element's happy / chew / pet / sheepish faces use. */
export function blushOf(e: DragonElement): string { return DRAGON_BLUSH[e] ?? DRAGON_SHARED.blush; }

/**
 * Mood-state colours (docs/ART_BIBLE.md sections 3.2, 3.4, 3.6). Derived, never stored, like the cel tones.
 * `banked`: fire's sleeping flame and rock's dim crystals (mood <= -0.3), the glow's own shadow tone.
 * `dimSpot`: water's dry or sad spots (mood <= -0.3), halfway between the spot marking and the scale it sits on.
 * palette-check gate (h) keeps every pair a mood swaps between >= the ladder apart, so the change is visible.
 */
export function moodTones(p: Readonly<DragonPalette>): { banked: string; dimSpot: string } {
  return { banked: makeTones(p.glow).sh, dimSpot: mix(p.marking, p.scale, 0.5) };
}

/**
 * Far-side shading, as `farPalette(p, shade, desat)` takes it (docs/ART_BIBLE.md, decision D8).
 * `legs`: the far front and far hind leg. Darker than the engine default because on a quadruped the far leg is
 *   seen right next to the near leg's shadow band (it crosses behind it on every walk step), and at 0.62 / 0.25
 *   the far scale lands within 25 % of that shadow tone on three of the six elements (tools/palette-check.ts, c2).
 *   Shriekscale's shadow tone is too close to the ink for any far shade to clear both, so its legs are thin enough
 *   (radius x0.75, bible 2.3) to stay under the engine's FLAT_R and never get a shadow band at all.
 * `wingAndHead`: the far wing and the far horn / ear-fan / fin-ear. These are seen against the lit top of the near
 *   body and head and against the background, never against a shadow band, so they keep the engine default:
 *   darker would sink the already-dark membranes into the outline and pull pale far horns onto the body's value.
 */
export const DRAGON_FAR = Object.freeze({
  legs: Object.freeze({ shade: 0.55, desat: 0.3 }),
  wingAndHead: Object.freeze({ shade: 0.62, desat: 0.25 }),
});
