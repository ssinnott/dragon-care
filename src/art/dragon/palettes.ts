// Dragon Care palettes: the 7 elements x 8 slots that colour all 28 dragon looks (docs/ART_BIBLE.md section 3), and
// the greying with age that derives each life stage's palette from them (bible 3.9).
//
// One BASE palette per element, stored once: it is the hatchling's colours, and every older stage is DERIVED from it
// by `agePalette` (a luminance-keeping pull toward grey, 3.9), never stored per stage. A baby, its young, adult and
// elder selves share one base, which is half of why they read as one species (the other half is the cue in the same
// place); the greying is a stage signal on top of it, as the eye's aspect and the neck are.
// The rig imports these values and tools/palette-check.ts measures them, at every stage. Change a hex or a greying
// strength here and re-run `node tools/palette-check.ts` before anything is drawn with it, because the check is what
// keeps the values honest.
//
// Slot roles (where each colour is painted) are in the DragonPalette comments. Derived tones (shadow, highlight,
// rim, deep) are NOT stored: they come from the engine's makeTones / toneOf ramp, and far-side colours from
// farPalette with DRAGON_FAR, so a ramp or far-shade change reaches every dragon at once. They are derived from the
// AGED base: makeTones(agePalette(...)[slot]).
import { mix, hexToRgb, rgbToHex } from '../../lib/art/palettes.ts';
import type { ColorMap } from '../../lib/art/palettes.ts';
import { makeTones, toneOf, RAMP } from '../../lib/art/shading.ts';
import type { Ramp, Tones } from '../../lib/art/shading.ts';

/** The seven elements, in roster order. */
export const DRAGON_ELEMENTS = ['fire', 'spike', 'rock', 'lightning', 'water', 'slinkwing', 'dusk'] as const;
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
   * Wing membrane, plus the element's skin features: water's fluke and fins, slinkwing's ear-fans, throat sac and
   * sound arcs, dusk's mist. Also the 1 px ring on water's bubbles and drips.
   */
  membrane: string;
  /** Horns, claws (drawn un-inked), spike quills, slinkwing fan ribs, water fin rays, dusk's lantern cap. */
  horn: string;
  /**
   * Element markings: flame-licks, tail rings, rock's dome carapace, bolt stripes, pearl spots, slinkwing's eye mask,
   * dusk's smoke tail tip and nose frost.
   */
  marking: string;
  /** Nostrils (2 x 2). The quill and claw tips it once coloured were dropped: at 2 px they were under the mark floor. */
  dark: string;
  /** The one saturated signal colour: flame, sap, crystals, sparks, glow spots, note glyphs, dusk's lamp. Drawn flat, never banded. */
  glow: string;
  /** Iris. Drawn flat inside a 1 px ink ring, so it never needs to separate from the scale. */
  eye: string;
}

/** The eight slot names, in table order. */
export type DragonSlot = 'scale' | 'belly' | 'membrane' | 'horn' | 'marking' | 'dark' | 'glow' | 'eye';
export const DRAGON_SLOTS: readonly DragonSlot[] = ['scale', 'belly', 'membrane', 'horn', 'marking', 'dark', 'glow', 'eye'];

/**
 * The BASE palette table: the hatchling's colours (every other stage is `agePalette` of these). Every value is
 * validated by tools/palette-check.ts at all four stages; see its report in docs/ART_BIBLE.md 5.8.
 */
export const DRAGON_PALETTES: Readonly<Record<DragonElement, Readonly<DragonPalette>>> = Object.freeze({
  fire: Object.freeze({
    scale: '#f04422', belly: '#e08a2c', membrane: '#7f1e3a', horn: '#734a4c',
    marking: '#ffe29a', dark: '#2b1418', glow: '#ffa21f', eye: '#ffc02e',
  }),
  spike: Object.freeze({
    scale: '#2f8232', belly: '#a3ad55', membrane: '#2e6b58', horn: '#f2e8c6',
    marking: '#173a19', dark: '#4a2618', glow: '#7dff8c', eye: '#ff9a3c',
  }),
  // (v2: the sandstone 0.01 Oklab dE warmer, `#d4b67c` -> `#d8b474`, so it has chroma to grey with: under
  // protanopia the greyed rock kept too little saturation to separate from the sea-green water; D22)
  rock: Object.freeze({
    scale: '#d8b474', belly: '#fff5cc', membrane: '#4c5670', horn: '#5e4e46',
    marking: '#7e5f44', dark: '#3b2c24', glow: '#b48cff', eye: '#ffb84a',
  }),
  lightning: Object.freeze({
    scale: '#2d58cc', belly: '#9fb4f2', membrane: '#ffcf33', horn: '#404a9c',
    marking: '#ffcf33', dark: '#141a3c', glow: '#fff6a0', eye: '#ffc41f',
  }),
  // sea green (v2): "light sea green", hue 176, the greenest a vivid water body can be and still separate from
  // every other body for dichromats (bible 3.6, D21); the deep sea-green membrane keeps it out of dusk's navy family
  water: Object.freeze({
    scale: '#28b0a6', belly: '#85c6ae', membrane: '#185e5b', horn: '#eaf6f0',
    marking: '#dcfff6', dark: '#0c2a2a', glow: '#40d8f0', eye: '#ffc64a',
  }),
  slinkwing: Object.freeze({
    scale: '#5a2f6e', belly: '#fff5f8', membrane: '#ff6fae', horn: '#f0dce6',
    marking: '#9a6aa8', dark: '#2e1638', glow: '#ff9ed2', eye: '#3fe0a0',
  }),
  // dusk "Wisp" (v2, bible 3.8): a navy hatchling that greys to storm slate at a nearly constant value (L ~0.08, the
  // one free slot of the value stack, between lightning and slinkwing); afterglow belly, moth-grey wings, a coral lamp
  dusk: Object.freeze({
    scale: '#3d4d91', belly: '#c28771', membrane: '#98a1b6', horn: '#e2e6f0',
    marking: '#c9cfdd', dark: '#10142a', glow: '#ffa98c', eye: '#7fb8ff',
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
 * water: under protanopia the shared pink lands too close to the sea-green scale; a paler pink clears it (the cyan
 *        body's `#feaebe` fails the sea green at 21 %).
 */
export const DRAGON_BLUSH: Readonly<Partial<Record<DragonElement, string>>> = Object.freeze({ rock: '#d8607a', water: '#ffbccb' });
/** The blush an element's happy / chew / pet / sheepish faces use. */
export function blushOf(e: DragonElement): string { return DRAGON_BLUSH[e] ?? DRAGON_SHARED.blush; }

/**
 * Mood-state colours (docs/ART_BIBLE.md sections 3.2, 3.4, 3.6, 3.8). Derived, never stored, like the cel tones.
 * Pass the stage's palette (`agedPalette`), so an old dragon's mood tones follow its greyed colours.
 * `banked`: fire's sleeping flame, rock's dim crystals (mood <= -0.3) and dusk's lamp's dark face, the glow's own
 *   shadow tone.
 * `dimSpot`: water's dry or sad spots (mood <= -0.3), halfway between the spot marking and the scale it sits on.
 * palette-check gate (h) keeps every pair a mood swaps between >= the ladder apart, so the change is visible.
 */
export function moodTones(p: Readonly<DragonPalette>): { banked: string; dimSpot: string } {
  return { banked: makeTones(p.glow).sh, dimSpot: mix(p.marking, p.scale, 0.5) };
}

/**
 * Per-element SHADOW tones, the one exception to "derived, never stored" (2.6, palette-check gates a and d): where
 * the engine's cool ramp greys a warm pale colour, the slot's `sh` is set by hand, hue kept, and its `deep` follows
 * from it (x 0.78). Rock: the sandstone's ramp shadow `#8c7e69` split the baby's face into a clean half and a grey,
 * dirty one (the other elements' head shadows keep their hue), and the cream belly's `#a8a9a7` read as a grey diaper
 * on the baby and a metal plate under the adult's chest (the cast reviews). `#a88a66` sits 44 % under the sand and
 * `#e6d49e` 27 % under the cream, 59 % over the new scale shadow it meets on the belly line. Older stages grey the
 * hand-set shadow with its slot (`dragonTones`).
 */
export const DRAGON_SHADOW: Readonly<Partial<Record<DragonElement, Readonly<Partial<Record<DragonSlot, string>>>>>> = Object.freeze({
  rock: Object.freeze({ scale: '#a88a66', belly: '#e6d49e' }),
});

// ---------------------------------------------------------------------------------------------------------------
// GREYING WITH AGE (bible 3.9). Derived, like farPalette: each stage's palette is the base pulled toward its own
// grey of EQUAL LUMINANCE, in linear light, by a strength k per element, stage and slot. Because luminance is kept
// (to one rounding step, times an optional drift 1 + lambda k), every luminance-based gate (the value stack, the
// ladder, the floor) holds by construction; only hue- and chroma-based passes and the colour-blind gates can move,
// and palette-check runs every gate at every stage.
// ---------------------------------------------------------------------------------------------------------------

/**
 * The palette's own names for the life stages, the elder included (bible 2.1). The rig's `Stage` (stages.ts) does
 * not have the elder yet; it is a subset of this.
 */
export const AGE_STAGES = ['baby', 'young', 'adult', 'elder'] as const;
export type AgeStage = typeof AGE_STAGES[number];

/** G[stage]: how grey each stage is, cast-wide (k = G x slot weight). A baby is its base palette. */
export const AGE_GREY: Readonly<Record<AgeStage, number>> = Object.freeze({ baby: 0, young: 0.08, adult: 0.18, elder: 0.45 });

/**
 * s[slot]: which parts grey, and how much. Skin greys (scale, belly, the membrane); pigment greys at half strength;
 * keratin (horn: claws, quills, fan ribs), the nostril, the signal glow ("the fire still burns") and the iris never do.
 */
export const AGE_WEIGHT: Readonly<Record<DragonSlot, number>> = Object.freeze({
  scale: 1, belly: 1, membrane: 1, horn: 0, marking: 0.5, dark: 0, glow: 0, eye: 0,
});

/** No slot is ever pulled more than this far toward grey: a body keeps a hue (the neutral ceiling, 3.1). */
export const AGE_K_MAX = 0.9;

/** One element's exceptions to the cast-wide greying. */
export interface AgeRule {
  /** Its own per-stage strength curve, replacing AGE_GREY (dusk: its blue-to-grey journey IS its growth). */
  curve?: Readonly<Record<AgeStage, number>>;
  /** Slot weights replacing AGE_WEIGHT's. */
  weight?: Readonly<Partial<Record<DragonSlot, number>>>;
  /** lambda per slot: luminance drifts by (1 + lambda k) as it greys (fire darkens toward brick, spike lightens to lichen). */
  drift?: Readonly<Partial<Record<DragonSlot, number>>>;
}

/**
 * Per-element greying exceptions (bible 3.9). Each is a measured fix, re-checked by palette-check at every stage:
 * fire   : its red body greys least and darkens a touch toward brick. Greyed fully, luminance-kept, fire and spike
 *          swap simulated luminance under protanopia near k 0.45 (1 % apart as elders); its age shows on the belly,
 *          wings, muzzle, brows and beard instead.
 * spike  : lightens a little toward lichen as it greys (its elder scale is then at the S 0.30 identity floor, gate j).
 * rock   : the sandstone greys at 0.3: under protanopia the greyed sand must keep >= 0.30 more simulated saturation
 *          than the sea-green water (which simulates to a grey) to separate from it (gate f, B3); its slate membrane
 *          at half strength keeps the membrane / horn pair, which passes on hue alone, chromatic.
 * lightning, slinkwing: the membrane is their signal colour, so it greys at half strength.
 * water  : greys at 0.8 and darkens a little as it greys: lighter, its elder meets fire's value under deuteranopia;
 *          darker, it meets the greyed rock under protanopia (gate f; bible 3.9).
 * dusk   : a curve of its own, the steepest in the cast (navy at hatching, storm slate as an elder), on the skin only:
 *          its moth-grey wings are grey from hatching, and its lamp and silver never age.
 */
export const AGE_RULES: Readonly<Partial<Record<DragonElement, Readonly<AgeRule>>>> = Object.freeze({
  fire: { weight: { scale: 0.3 }, drift: { scale: -0.6 } },
  spike: { weight: { scale: 0.9 }, drift: { scale: 0.2 } },
  rock: { weight: { scale: 0.3, membrane: 0.5 } },
  lightning: { weight: { membrane: 0.5 } },
  water: { weight: { scale: 0.8 }, drift: { scale: -0.15 } },
  slinkwing: { weight: { membrane: 0.5 } },
  dusk: { curve: { baby: 0, young: 0.3, adult: 0.55, elder: 0.76 }, weight: { belly: 0.75, membrane: 0, marking: 0 } },
});

/** k: how far one slot of one element is pulled toward grey at a stage (0 = the base colour). */
export function ageK(e: DragonElement, stage: AgeStage, slot: DragonSlot): number {
  const r = AGE_RULES[e], g = (r && r.curve ? r.curve : AGE_GREY)[stage];
  const w = r && r.weight && r.weight[slot] != null ? r.weight[slot]! : AGE_WEIGHT[slot];
  return Math.min(AGE_K_MAX, g * w);
}
/** lambda: the slot's luminance drift as it greys (0 = luminance kept). */
export function ageDrift(e: DragonElement, slot: DragonSlot): number {
  const r = AGE_RULES[e];
  return r && r.drift && r.drift[slot] != null ? r.drift[slot]! : 0;
}

function linC(c: number): number { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
function unlinC(v: number): number { const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, c * 255)); }
/** WCAG relative luminance of an sRGB hex (the palette check's lumOf). */
export function lumOfHex(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linC(r) + 0.7152 * linC(g) + 0.0722 * linC(b);
}

/**
 * The greying transform (bible 3.9): pull `hex` toward its own grey of equal luminance by k (0..1), in linear light,
 * then scale its luminance by (1 + lambda k). Per channel: c' = (c + (Y - c) k)(1 + lambda k), Y the WCAG relative
 * luminance. Luminance comes out as Y (1 + lambda k) within one rounding step; the hue is kept exactly in linear light
 * (about 2 deg in sRGB) and the saturation falls by about (1 - k).
 */
export function ageShade(hex: string, k: number, lambda = 0): string {
  if (k <= 0) return hex;
  const [r8, g8, b8] = hexToRgb(hex), r = linC(r8), g = linC(g8), b = linC(b8);
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, f = 1 + lambda * k;
  const ch = (c: number) => unlinC(Math.min(1, Math.max(0, (c + (Y - c) * k) * f)));
  return rgbToHex(ch(r), ch(g), ch(b));
}

/** A stage's palette: every slot of `p` (the element's base) greyed by its ageK and ageDrift. Allocates: cache it. */
export function agePalette(p: Readonly<DragonPalette>, e: DragonElement, stage: AgeStage): DragonPalette {
  const o = { ...p } as DragonPalette;
  for (const s of DRAGON_SLOTS) o[s] = ageShade(p[s], ageK(e, stage, s), ageDrift(e, s));
  return o;
}

const AGED = new Map<string, Readonly<DragonPalette>>();
/** The element's palette at a stage (cached, frozen). `agedPalette(e, 'baby')` is DRAGON_PALETTES[e]. */
export function agedPalette(e: DragonElement, stage: AgeStage): Readonly<DragonPalette> {
  if (stage === 'baby') return DRAGON_PALETTES[e];
  const key = e + ':' + stage;
  let p = AGED.get(key);
  if (!p) { p = Object.freeze(agePalette(DRAGON_PALETTES[e], e, stage)); AGED.set(key, p); }
  return p;
}

/**
 * One slot's cel tones for an element at a stage: the engine's makeTones on the aged colour, with DRAGON_SHADOW's
 * hand-set shadow (greyed by the same k and lambda) if it has one. `stage` defaults to the base palette.
 */
export function dragonTones(e: DragonElement, slot: DragonSlot, ramp: Readonly<Ramp> = RAMP, stage: AgeStage = 'baby'): Tones {
  const t = makeTones(agedPalette(e, stage)[slot], ramp), o = DRAGON_SHADOW[e], sh0 = o ? o[slot] : undefined;
  if (!sh0) return t;
  const sh = ageShade(sh0, ageK(e, stage, slot), ageDrift(e, slot));
  return { ...t, sh, deep: toneOf(sh, 0.78) };
}

/**
 * The elder's grey muzzle, brow tuft and beard colour (bible 2.5, "The elder face"), derived from the elder palette:
 * the belly (or, where the belly is near-white, L > 0.8: rock's cream, slinkwing's white, a mix 0.4 toward the scale,
 * so it never reads as a bandage) pulled 0.85 of the way to its own grey.
 */
export function muzzleOf(p: Readonly<DragonPalette>, e?: DragonElement): string {
  const from = e ? MUZZLE_SLOT[e] : undefined;
  if (from) return p[from];
  const src = lumOfHex(p.belly) > 0.8 ? mix(p.belly, p.scale, 0.4) : p.belly;
  return ageShade(src, 0.85);
}
/**
 * Elements whose elder muzzle is an existing slot instead of the derived grey: dusk's nose frost (its `marking`, the
 * grey that has crept in from the nose since the young stage, 3.8) simply grows back to the eye line as an elder.
 */
export const MUZZLE_SLOT: Readonly<Partial<Record<DragonElement, DragonSlot>>> = Object.freeze({ dusk: 'marking' });
/** Slinkwing's elder-only frosted fan tips (3.7): halfway from the muzzle grey to the catchlight white. */
export function fanFrostOf(p: Readonly<DragonPalette>): string { return mix(muzzleOf(p), DRAGON_SHARED.catchlight, 0.5); }

/**
 * Far-side shading, as `farPalette(p, shade, desat)` takes it (docs/ART_BIBLE.md, decision D8).
 * `legs`: the far front and far hind leg. Darker than the engine default because on a quadruped the far leg is
 *   seen right next to the near leg's shadow band (it crosses behind it on every walk step), and at 0.62 / 0.25
 *   the far scale lands within 25 % of that shadow tone on three of the six elements (tools/palette-check.ts, c2).
 *   Slinkwing's and dusk's shadow tones are too close to the ink for any far shade to clear both, so their legs are
 *   thin enough (radius x0.75 / x0.76, bible 2.3) to stay under the engine's FLAT_R and never get a shadow band.
 * `wingAndHead`: the far wing and the far horn / ear-fan / fin-ear. These are seen against the lit top of the near
 *   body and head and against the background, never against a shadow band, so they keep the engine default:
 *   darker would sink the already-dark membranes into the outline and pull pale far horns onto the body's value.
 */
export const DRAGON_FAR = Object.freeze({
  legs: Object.freeze({ shade: 0.55, desat: 0.3 }),
  wingAndHead: Object.freeze({ shade: 0.62, desat: 0.25 }),
});
