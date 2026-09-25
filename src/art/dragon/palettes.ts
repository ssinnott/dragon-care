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
  /** Horns, claws (drawn un-inked), spike quills, slinkwing fan ribs, water fin rays and elder pearls, dusk's lantern cap and bail. */
  horn: string;
  /**
   * Element markings: flame-licks, tail rings, rock's dome carapace, bolt stripes, pearl spots, slinkwing's eye mask,
   * dusk's smoke tail tip and nose frost (its elder muzzle).
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
  // every other body for dichromats (bible 3.6, D27; jade and a true sea green are the user's alternatives there);
  // the deep sea-green membrane sits between spike's leaf green and dusk's blue body
  water: Object.freeze({
    scale: '#28b0a6', belly: '#85c6ae', membrane: '#185e5b', horn: '#eaf6f0',
    marking: '#dcfff6', dark: '#0c2a2a', glow: '#40d8f0', eye: '#ffc64a',
  }),
  slinkwing: Object.freeze({
    scale: '#5a2f6e', belly: '#fff5f8', membrane: '#ff6fae', horn: '#f0dce6',
    marking: '#9a6aa8', dark: '#2e1638', glow: '#ff9ed2', eye: '#3fe0a0',
  }),
  // dusk "Wick" (v2, bible 3.8): a deep Prussian-blue hatchling that greys to storm slate at a constant value (L 0.083,
  // the one free slot of the value stack, between lightning and slinkwing). Its hue sits 17 deg (HSV; 19 in Oklab)
  // toward petrol from lightning's cobalt, so the two dark blues part by Oklab dE >= 0.1 as well as by value (gate b's
  // dark-pair floor; the first draft's #3d4d91 was 0.056 from the greyed lightning). Afterglow belly, moth-grey wings, a smoke
  // grey tail tip and nose frost at L 0.47 (the first draft's #c9cfdd sat 8 % from the straw floor), a coral lamp, and
  // a deep periwinkle iris (#6f86ff, 70 % from the catchlight; the first #7fb8ff, pale sky, 49 %, under the baby's
  // black pupil block read as a welling tear: cast review v2)
  dusk: Object.freeze({
    scale: '#1f5580', belly: '#c28771', membrane: '#98a1b6', horn: '#e2e6f0',
    marking: '#b0b7ca', dark: '#10142a', glow: '#ffa98c', eye: '#6f86ff',
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
 * Dusk's smoke band (bible 3.8): the slate step of its tail tip's flat, stepped fade (navy -> slate band -> smoke tip),
 * halfway from the scale to the smoke marking. Derived per stage, like `moodTones().dimSpot`; gates a and i measure it.
 */
export function smokeBandOf(p: Readonly<DragonPalette>): string { return mix(p.scale, p.marking, 0.5); }

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
 * on the baby and a metal plate under the adult's chest (the cast reviews). `#a88a66` sits 43 % under the sand and
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
//
// "As dragons get older they should get a little grayer": the baby and the young (a teenager) are their base colours;
// the adult is a little grey and the elder clearly grey. What a player SEES grey is put where identity is not carried:
// the lit band of the body and head (the scale's highlight tone, silvered by AGE_SILVER: a silver back and crown),
// the belly and wings, and the elder's muzzle, brow tuft and beard. The body colour itself greys little, since it
// carries the element's colour identity (gates b, f, j). palette-check gate (k) holds every greying step to a visible
// one: >= 0.03 Oklab dE on the scale or its highlight band.
// ---------------------------------------------------------------------------------------------------------------

/**
 * The palette's own names for the life stages, the elder included (bible 2.1): the same four as the rig's `Stage`
 * (stages.ts), kept here so this module and tools/palette-check.ts need nothing of the rig.
 */
export const AGE_STAGES = ['baby', 'young', 'adult', 'elder'] as const;
export type AgeStage = typeof AGE_STAGES[number];

/**
 * G[stage]: how grey each stage is, cast-wide (k = G x slot weight). A baby and a young dragon are their base
 * palette (the young's old 0.08 moved no colour by more than 0.015 Oklab dE, under what anyone can see, and it cost
 * fire / spike its greyscale step: bible 3.9).
 */
export const AGE_GREY: Readonly<Record<AgeStage, number>> = Object.freeze({ baby: 0, young: 0, adult: 0.18, elder: 0.45 });

/**
 * How far the scale's HIGHLIGHT tone is pulled on toward its own grey (luminance kept), on top of the scale's own
 * greying: the lit band on the back and crown silvers first, as a real animal greys (bible 3.9, "the silver back").
 * The band is where identity is not carried, so it can grey visibly while the base and shadow keep the element's hue.
 */
export const AGE_SILVER: Readonly<Record<AgeStage, number>> = Object.freeze({ baby: 0, young: 0, adult: 0.3, elder: 0.6 });

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
  /** The first stage a slot greys at (it keeps its base colour before it): fire's and spike's scale grey only as elders. */
  from?: Readonly<Partial<Record<DragonSlot, AgeStage>>>;
  /**
   * The weight a slot's HAND-SET shadow (DRAGON_SHADOW) greys at, where it differs from the slot's own: rock's cream
   * belly greys at 1.5 but its warm shadow at 0.5, or the elder's belly band shaded to a neutral grey panel between the
   * legs (the grey diaper the hand-set shadow was made to cure: the elder core review).
   */
  shadow?: Readonly<Partial<Record<DragonSlot, number>>>;
  /**
   * Slot weights at the ELDER stage only, replacing `weight`'s there: lightning's and slinkwing's bellies 1.5, dusk's
   * 0.25 (cast review v2: see AGE_RULES).
   */
  elder?: Readonly<Partial<Record<DragonSlot, number>>>;
  /** Its own AGE_SILVER per stage, the highlight band's silvering (lightning's and slinkwing's elders 0.8). */
  silver?: Readonly<Record<AgeStage, number>>;
}

/**
 * Per-element greying exceptions (bible 3.9). Each is a measured fix, re-checked by palette-check at every stage:
 * fire   : its red body greys only as an elder, least of all, and darkens a touch toward brick. Greyed fully,
 *          luminance-kept, fire and spike swap simulated luminance under protanopia near k 0.45; greyed from the
 *          adult stage, the two pass on hue alone in greyscale from there (the ledger's E10 is now the elder's only).
 *          Its belly and wings grey at 0.6: fully, the orange belly went khaki and the wine membrane brown.
 * spike  : its body greys only as an elder, lightening a little toward lichen (the other half of the fire / spike
 *          fix); belly and leaf membrane at 0.6 (fully, they went olive-drab).
 * rock   : the sandstone greys at 0.25: under protanopia the greyed sand must keep >= 0.30 more simulated saturation
 *          than the sea-green water (which simulates to a grey) to separate from it (gate f, B3). Its age shows on the
 *          dome (marking at full weight: S 0.46 -> 0.27, still chromatic, so the dim crystals keep their hue pass on
 *          it), the cream belly (1.5) and the silver crown; its slate membrane at half strength keeps the membrane /
 *          horn pair, which passes on hue alone, chromatic. The belly's hand-set warm shadow greys at 0.5 only: at
 *          the belly's 1.5 the elder's shadow went a neutral #dbd5c5, and with the elder's paunch the belly read as a
 *          grey nappy between the legs.
 * lightning: its cobalt body greys at half strength, so its elder stays well clear of dusk's dark blue (gate b's
 *          dark-pair floor); its membrane is the signal colour and greys at half strength too.
 * water  : greys at 0.8, luminance kept: darkened as it greys, its elder meets fire's value under deuteranopia (the
 *          proposal's -0.3 drift failed there); greyed fully, the rock / water protan margin thins (gate f). Its fins
 *          at 0.6, so the elder's deep sea green does not grey onto spike's leaf.
 * slinkwing: the membrane is its signal colour, so it greys at half strength.
 * dusk   : a curve of its own (navy kept through the young and adult, storm slate as an elder: its blue-to-grey
 *          journey is its growth, bible 3.8), on the skin only, capped at 0.65 so the elder keeps S >= 0.30 like every
 *          other body; its belly at half strength (fully, the ash-rose read as bare skin), and as an elder at a
 *          quarter, the afterglow kept warm (at half, its mauve-grey shadow covered a diagonal half of the torso and
 *          the elder was the drabbest look in the cast, about half its pixels neutral: cast review v2); its moth-grey
 *          wings are grey from hatching, and its smoke, silver, lamp and iris never age.
 * The two elders whose bodies barely greyed at game scale (cast review v2: adult -> elder 0.018 and 0.028 Oklab dE on
 * the scale, the elder Zap the adult's vivid blue with a grey muzzle), lightning and slinkwing, silver their highlight
 * band further as elders (0.8, not 0.6) and grey their bellies at 1.5 there: neither slot carries their identity (the
 * bolts and the fans do), so the silver back and the greyer belly show the age. Their elder scales grey a step more
 * too (cast review v2 round 2: still the adult's colour at game scale, an adult in a grey mask): lightning's 0.65 (its
 * closest dusk pair, the elder Zap against the baby Wick, 0.095 Oklab dE and 30 % in value: B2), slinkwing's 1.2
 * (0.54: S 0.35, its B1 hue pass with dusk kept). Rock's elder, the least greyed of the cast after that (its scale
 * 0.25 is held by gate f's protan rock / water pair), silvers its highlight band at 0.8 as well and greys its dome at
 * 1.3 (cast review v2 round 2): the sand stays, the crown and the carapace go stone grey.
 */
export const AGE_RULES: Readonly<Partial<Record<DragonElement, Readonly<AgeRule>>>> = Object.freeze({
  fire: { weight: { scale: 0.3, belly: 0.6, membrane: 0.6 }, drift: { scale: -0.6 }, from: { scale: 'elder' } },
  spike: { weight: { scale: 0.9, belly: 0.6, membrane: 0.6 }, drift: { scale: 0.2 }, from: { scale: 'elder' } },
  rock: { weight: { scale: 0.25, belly: 1.5, membrane: 0.5, marking: 1 }, elder: { marking: 1.3 }, shadow: { belly: 0.5 }, silver: { baby: 0, young: 0, adult: 0.3, elder: 0.8 } },
  lightning: { weight: { scale: 0.5, membrane: 0.5 }, elder: { scale: 0.65, belly: 1.5 }, silver: { baby: 0, young: 0, adult: 0.3, elder: 0.8 } },
  water: { weight: { scale: 0.8, membrane: 0.6 } },
  slinkwing: { weight: { membrane: 0.5 }, elder: { scale: 1.2, belly: 1.5 }, silver: { baby: 0, young: 0, adult: 0.3, elder: 0.8 } },
  dusk: { curve: { baby: 0, young: 0.12, adult: 0.3, elder: 0.65 }, weight: { belly: 0.5, membrane: 0, marking: 0 }, elder: { belly: 0.25 } },
});

/** k: how far one slot of one element is pulled toward grey at a stage (0 = the base colour). */
export function ageK(e: DragonElement, stage: AgeStage, slot: DragonSlot): number {
  const r = AGE_RULES[e], g = (r && r.curve ? r.curve : AGE_GREY)[stage];
  const from = r && r.from ? r.from[slot] : undefined;
  if (from && AGE_STAGES.indexOf(stage) < AGE_STAGES.indexOf(from)) return 0;
  const we = stage === 'elder' && r && r.elder ? r.elder[slot] : undefined;
  const w = we != null ? we : r && r.weight && r.weight[slot] != null ? r.weight[slot]! : AGE_WEIGHT[slot];
  return Math.min(AGE_K_MAX, g * w);
}
/** How far an element's scale highlight silvers at a stage: its AgeRule `silver`, else AGE_SILVER (3.9). */
export function ageSilver(e: DragonElement, stage: AgeStage): number {
  const r = AGE_RULES[e];
  return r && r.silver ? r.silver[stage] : AGE_SILVER[stage];
}
/** k for a slot's hand-set shadow (DRAGON_SHADOW): its AgeRule `shadow` weight where it has one, else the slot's k. */
export function ageKShadow(e: DragonElement, stage: AgeStage, slot: DragonSlot): number {
  const r = AGE_RULES[e], w = r && r.shadow ? r.shadow[slot] : undefined;
  if (w == null) return ageK(e, stage, slot);
  const from = r && r.from ? r.from[slot] : undefined;
  if (from && AGE_STAGES.indexOf(stage) < AGE_STAGES.indexOf(from)) return 0;
  return Math.min(AGE_K_MAX, (r && r.curve ? r.curve : AGE_GREY)[stage] * w);
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

/**
 * `hex` moved to relative luminance `L`, hue kept, in linear light: darker by scaling every channel, lighter by
 * mixing toward white (so no channel clips and L is exact to one rounding step). The elder face greys use it.
 */
export function atLum(hex: string, L: number): string {
  const [r8, g8, b8] = hexToRgb(hex), c = [linC(r8), linC(g8), linC(b8)];
  const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const out = L <= Y ? c.map((v) => (Y > 0 ? v * L / Y : L)) : c.map((v) => v + (1 - v) * (L - Y) / (1 - Y));
  return rgbToHex(unlinC(out[0]), unlinC(out[1]), unlinC(out[2]));
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
 * hand-set shadow (greyed by its own k, ageKShadow, and the slot's lambda) if it has one, and the scale's highlight silvered by ageSilver
 * (luminance kept). `stage` defaults to the base palette. The rig seeds its tone cache from this for every slot.
 */
export function dragonTones(e: DragonElement, slot: DragonSlot, ramp: Readonly<Ramp> = RAMP, stage: AgeStage = 'baby'): Tones {
  let t = makeTones(agedPalette(e, stage)[slot], ramp);
  const sv = ageSilver(e, stage);
  if (slot === 'scale' && sv > 0) t = { ...t, hi: ageShade(t.hi, sv) };
  const o = DRAGON_SHADOW[e], sh0 = o ? o[slot] : undefined;
  if (!sh0) return t;
  const sh = ageShade(sh0, ageKShadow(e, stage, slot), ageDrift(e, slot));
  return { ...t, sh, deep: toneOf(sh, 0.78) };
}

// ---------------------------------------------------------------------------------------------------------------
// THE ELDER FACE GREYS (bible 2.5). The muzzle (a pigment patch on the front of the snout) and the brow tuft share
// one grey, but for the pale-muzzled elders' tuft (TUFT_LUM); the beard is its own inked hair tuft under the chin and
// may take a grey of its own. Each is the elder's
// belly pulled 0.85 of the way to its own grey and then set to a LUMINANCE chosen per element, because a grey that
// keeps the belly's luminance (the first draft) is 0 % from the belly it grows beside. The luminances sit in each
// element's measured window (palette-check gates a and i):
//   muzzle / tuft: >= 25 % from the scale, its shadow tone, the nostril and the ink (slinkwing: its mask; rock: its
//                  nose horn);
//   beard        : >= 25 % from the belly, the belly's shadow tone, the scale's shadow tone (the closed jaw's sliver),
//                  the ink and the straw floor (a sleeping elder's chin and beard rest on it).
// On every element the beard is the muzzle's grey, water's a pale sea frost (its mid sea-slate beard under the white
// snout read as a pebble in the mouth; the near-white frost made a stark white snout and, hanging under it, a white
// tusk: cast review v2) and rock's its white (no single grey clears both lists there: its muzzle window is light,
// >= 0.65, its beard window mid, 0.37 to 0.50; the mid stone beard under the white snout and chin read as a stone or
// a leaf stuck under the jaw: cast review v2 round 2). The muzzle grey also wraps the jaw's front, the elder's grey
// chin (parts.ts drawJaw), so the beard grows out of it. No one grey clears water's beard list (its belly and the
// straw sit 0.48 and 0.67), and rock's white sits 5 % from its cream throat stripe and 22 % from the straw, so their
// beards, inked on the outer contour, are exempt from the floor gate, rock's from the stripe too (tools/palette-check.ts,
// bible 5.6 E14, E15).
// ---------------------------------------------------------------------------------------------------------------

/**
 * Relative luminance of the elder muzzle and brow tuft, per element (dusk's is its smoke marking: MUZZLE_SLOT). Rock's
 * is a white old dog's muzzle, 0.86 (#efefed): at 0.72 the muzzle and tuft were a pale smudge on its tan face beside
 * the silvered crown, 33 % from the scale (now 44 %; the element pass v2 review). Water's is a pale frost, 0.65 (47 %
 * from its scale, 26 % from its belly): at 0.92, near white, it was the stark white patch the eye went to first
 * (cast review v2).
 */
export const MUZZLE_LUM: Readonly<Partial<Record<DragonElement, number>>> = Object.freeze({
  fire: 0.48, spike: 0.265, rock: 0.86, lightning: 0.315, water: 0.65, slinkwing: 0.285,
});
/**
 * Relative luminance of the elder beard, where it differs from the muzzle's: none now. (Water's was a mid sea-slate,
 * 0.32, since its frost as the first beard's trapezoid under the chin read as a buck tooth; under the white snout the
 * slate tuft read as a pebble in the mouth, and as the swept-back tuft grown from the grey chin its beard is the
 * muzzle's pale frost: cast review v2. Rock's was a mid stone grey, 0.43, its beard window's, a separate grey lump
 * under its white chin; it is the white now, an old dog's chin tuft: cast review v2 round 2, 5.6 E15.)
 */
export const BEARD_LUM: Readonly<Partial<Record<DragonElement, number>>> = Object.freeze({});
/**
 * Relative luminance of the elder's BROW TUFT where it is not the muzzle grey: the pale-muzzled elders, whose tuft in
 * the muzzle's near-white was the brightest mark on the face, a strip of tape across the brow that pulled the eye
 * from the eye (cast review v2): water's a pale grey at 0.60 (43 % from its scale), rock's 0.68 (28 %). Their tuft is
 * also the short one (faces.ts drawBrow: 5 px with rounded ends, not 7). The frost stays on the snout.
 */
export const TUFT_LUM: Readonly<Partial<Record<DragonElement, number>>> = Object.freeze({ water: 0.60, rock: 0.68 });
/**
 * Elements whose elder muzzle, tuft and beard are an existing slot instead of the derived grey: dusk's nose frost
 * (its `marking`, the smoke grey that has crept in from the nose since the young stage, 3.8) grows back to the eye.
 */
export const MUZZLE_SLOT: Readonly<Partial<Record<DragonElement, DragonSlot>>> = Object.freeze({ dusk: 'marking' });

/** The elder's grey muzzle and brow tuft (bible 2.5), from the elder palette `p` of element `e`. */
export function muzzleOf(p: Readonly<DragonPalette>, e: DragonElement): string {
  const from = MUZZLE_SLOT[e];
  if (from) return p[from];
  return atLum(ageShade(p.belly, 0.85), MUZZLE_LUM[e] ?? lumOfHex(p.belly));
}
/** The elder's brow tuft (bible 2.5): the muzzle grey, or TUFT_LUM's on a pale-muzzled elder (water, rock). */
export function tuftOf(p: Readonly<DragonPalette>, e: DragonElement): string {
  const L = TUFT_LUM[e];
  return L == null ? muzzleOf(p, e) : atLum(ageShade(p.belly, 0.85), L);
}
/** The elder's beard (bible 1.2, 2.5): the muzzle grey, or BEARD_LUM's where an element sets one (none now). */
export function beardOf(p: Readonly<DragonPalette>, e: DragonElement): string {
  const L = BEARD_LUM[e];
  return L == null ? muzzleOf(p, e) : atLum(ageShade(p.belly, 0.85), L);
}
/** Slinkwing's elder-only frosted fan tips (3.7): halfway from its muzzle grey to the catchlight white. */
export function fanFrostOf(p: Readonly<DragonPalette>, e: DragonElement = 'slinkwing'): string {
  return mix(muzzleOf(p, e), DRAGON_SHARED.catchlight, 0.5);
}

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
