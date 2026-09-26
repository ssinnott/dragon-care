// Palette ladder check for the dragon palettes (src/art/dragon/palettes.ts), measured, never eyeballed.
//
//   node tools/palette-check.ts          full report, exit code 1 if any gate fails
//
// It reads only the palette data and the engine's own colour maths (toneOf / makeTones from shading.ts,
// farPalette from palettes.ts): no canvas, no rig, no browser. That makes it the cheapest check in the art
// pipeline, in the same spirit as the "palette tier" docs/ART_GENERATOR.md describes, so run it before drawing
// anything with a new hex. Its report is pasted into docs/ART_BIBLE.md 5.8; re-paste it when a value changes.
//
// STAGES (v2). Every gate runs on every element's palette at each of the FOUR life stages, baby, young, adult and
// elder: the base palette greyed by palettes.ts `agedPalette` (bible 3.9), its cel tones, far tones and mood tones
// derived from the greyed colours. A report line carries one number per stage, "b/y/a/e"; a failing stage's number
// is marked "!". Each number is one gate. Gates (b) and (f) also run ACROSS stages (an elder shares the habitat with
// babies): every element pair at all 16 stage combinations.
//
// GATES (a failure sets exit code 1):
//   (a) adjacency : within each dragon, every pair of colours that touch on the sprite separates by
//                   >= 25 % relative luminance OR >= 40 deg hue (the house ladder). Hue only counts when both
//                   colours are chromatic (HSV S >= 0.20 and V >= 0.25): the hue angle of a near-grey or a
//                   near-black is noise, not colour. Pairs include the cel tones a pigment edge crosses: a marking
//                   runs through the body's shadow and highlight bands, and the belly line runs through the shadow.
//                   The elder adds its face: the grey muzzle and brow tuft, and the beard (its own inked hair tuft),
//                   against what they touch (bible 2.5; rock's white beard exempt from the throat stripe, inked:
//                   5.6 E15), and its elder-only extras (section 3).
//   (b) elements  : the seven SCALE colours (the body, about half of every sprite) are pairwise distinguishable at
//                   every pair of stages. See RULE_B below for the rule and why; a pair that passes on value alone
//                   (B2) must also clear the dark-pair floor (OKL_MIN, or OKDE_MIN of Oklab dE).
//   (c) far side  : c1 the engine's farPalette(p, 0.62, 0.25) far scale and far membrane keep >= 25 % luminance
//                   from the near scale; c2 the rig's own far LEG shading (DRAGON_FAR.legs) keeps >= 25 % AND
//                   >= OKL_MIN Oklab lightness from the near leg's base AND its shadow band; c3 the rig's far wing /
//                   head shading keeps the far membrane and any far paired horn >= 25 % from the near scale.
//   (d) ramps     : makeTones keeps shadow != base != highlight (and deep != shadow) after rounding, for every slot;
//                   a hand-set shadow (palettes.ts DRAGON_SHADOW, rock's) keeps >= 25 % luminance under its base.
//   (e) ink floor : far leg scale, far membrane and far paired horns stay >= 25 % luminance AND >= OKL_MIN Oklab
//                   lightness from the outline, so far parts do not sink into the ink.
//   (f) colour-blind: the same body pairs, at every pair of stages, still pass RULE_B under simulated deuteranopia
//                   and protanopia (about 1 player in 16 sees one of those two ways), because the habitat puts several
//                   dragons side by side and a player must tell their pets apart by more than the silhouette alone.
//                   The blush on each cheek is checked the same way (with the ladder), since it carries the happy face.
//   (h) mood states: every pair of colours a mood swaps between passes the ladder, so the change can be seen.
//   (i) floor     : every scale, every belly, the outer colour of every effect that lands on the floor, every marking
//                   that runs along the silhouette's edge (dusk's smoke tail tip and its band), dusk's lamp resting
//                   on the floor asleep, and the elder's beard (a sleeping elder's chin rests on it; water's and
//                   rock's are exempt, inked: bible 5.6 E14, E15) keep >= 25 % luminance from EVERY floor anyone
//                   stands on (src/game/surfaces.ts FLOORS: the straw of the base's rooms, landings, lift car and
//                   Aerie deck, and any floor a later slice adds), and each floor's HSV S is < 0.20 (a counted gate:
//                   hue cannot help on a floor, so none may carry one).
//   (j) identity  : greying never takes a body's hue away: every scale keeps HSV S >= 0.30 at every stage, so gate
//                   (b)'s B1 and the neutral ceiling (<= 40 % neutral area) keep holding for elders.
//   (k) visible greying: each greying step (young -> adult, adult -> elder) moves the scale or its highlight band
//                   (the silver back and crown, palettes.ts AGE_SILVER) by >= GREY_STEP Oklab dE, over the ~0.02 a
//                   player can see, so "a little greyer" is a step anyone sees, not a number.
// BACKDROPS (counted apart, its own RESULT line: BACKDROPS):
//   (w) backdrops : everything a dragon is seen against (src/game/surfaces.ts: the sky's three bands, the far hills and
//                   the clouds at every phase of the day AND the two stepped mixes between each phase and the next --
//                   the sky turns in thirds, so a mix is on screen for a third of an hour --, every room wall, the bare
//                   and lift-shaft walls, the towers' stone, the big props right behind a slot, and the light the dorm
//                   lamps and the hearth throw on their walls at night) keeps >= 25 % luminance from every DARK body
//                   (an element's scale under L 0.15 at a stage: lightning, dusk and slinkwing at every stage), and
//                   >= OKL_MIN Oklab L from the outline. The sky, the hills, the clouds, the walls, the stone and the
//                   lamps' light must be that much LIGHTER than each dark body (L >= about 0.16: a colour darker than
//                   slinkwing is as far from it by relDiff, and black), so night stays mid-value (the blue hour, never
//                   black: a dark dragon on the Aerie at night still shows) and a wall is never the colour of a dark
//                   body; a big prop may lie either way (the hearth's firebox is a dark mouth behind kitchen slot 0).
// EGGS (counted apart, its own RESULT line: EGGS):
//   (egg) eggs    : every element's egg (src/game/eggs.ts: its shell is the element's BABY scale colour, inked round)
//                   keeps >= 25 % luminance from the Hatchery's nest straw it lies in (src/game/surfaces.ts NEST), so a
//                   pale egg (rock's) and a dark one (slinkwing's, dusk's) both read in the nest; and (egg-lie) the
//                   straw is all it is seen against: every pixel just outside its ink ring, at every wobble, lies in
//                   the nest heap's plain straw (src/game/layout.ts NEST_RX, NEST_RY, eggBottom: a px in from the
//                   heap's inked edge, over the floor's band, off the strands), never the Hatchery's wall.
// REPORTED, NOT GATED:
//   (g) any scale pair that passes (b) on hue alone at the same stage (it would merge in greyscale); any body pair
//       that passes (f) on simulated value alone under the dark-pair floor (they are told apart by zone); glow colours
//       close to another element's glow (they must then differ by effect shape).
import { hexToRgb, farPalette } from '../src/lib/art/palettes.ts';
import { toneOf, RAMP } from '../src/lib/art/shading.ts';
import {
  DRAGON_ELEMENTS, DRAGON_SHARED, DRAGON_FAR, DRAGON_SLOTS, DRAGON_SHADOW, AGE_STAGES, AGE_SILVER, ageSilver, blushOf, moodTones,
  dragonTones, agedPalette, ageK, muzzleOf, tuftOf, beardOf, fanFrostOf, smokeBandOf,
} from '../src/art/dragon/palettes.ts';
import type { DragonElement, DragonPalette, DragonSlot, AgeStage } from '../src/art/dragon/palettes.ts';
import { makeTones } from '../src/lib/art/shading.ts';
import { KEEPER_PALETTES, KEEPER_SHARED, KEEPER_SKIN_SHADOW, KEEPER_FAR } from '../src/art/keeper/palettes.ts';
import type { KeeperPalette } from '../src/art/keeper/palettes.ts';
import { KEEPER_IDS } from '../src/art/keeper/cast.ts';
import type { KeeperId } from '../src/art/keeper/cast.ts';
import { BOWL } from '../src/art/props.ts';
import { FLOORS, INK, BACKDROPS, WALLS, PROPS, NEST, LAMP_RINGS, HEARTH_RING, stepped } from '../src/game/surfaces.ts';
import { NEST_RX, NEST_RY, NEST_STRANDS, WALL_H, floorTop, nestBase, eggBottom } from '../src/game/layout.ts';
import { SHELL, WOBBLE } from '../src/game/eggs.ts';
import { PHASE_ORDER } from '../src/game/clock.ts';

// ---------- thresholds ----------
/** House ladder: adjacent parts separate by this relative luminance difference... */
const LUM_MIN = 0.25;
/** ...or by this many degrees of hue. */
const HUE_MIN = 40;
/** Below this HSV saturation, or below CHROMA_V value, a colour's hue is not trusted. */
const CHROMA_S = 0.2;
const CHROMA_V = 0.25;
/**
 * Dark-pair floor, in Oklab lightness x 100. The relative-luminance ratio is scale-free, so it is lenient in the
 * darks: two near-blacks can sit 35 % apart in luminance and still be 4.7 Oklab L apart, which renders as one mass
 * (the engine's docs record a fused pair at 3.9: Brunhild's sleeve on her pauldron). Gates c2 and (e) compare dark
 * colours against dark colours, so they need both numbers.
 */
const OKL_MIN = 6;
/**
 * The dark-pair floor for body colours, gate (b): a pair that separates by value alone (B2) must ALSO be >= OKL_MIN
 * Oklab L apart or >= this Oklab dE apart (hue and chroma counting). Two dark blues 30 % apart in luminance but 5.5
 * Oklab L and 0.056 dE apart (the first draft's dusk against the greyed lightning) render as one navy.
 */
const OKDE_MIN = 0.08;
/** Gate (k): the least Oklab dE a greying step must move the scale or its highlight band by (a JND is about 0.02). */
const GREY_STEP = 0.03;
/**
 * RULE_B, cross-element body colours. A pair passes if ANY of these holds:
 *   B1 hue   : both scales have S >= 0.30 and are >= 40 deg apart. A body colour covers about half the sprite, so a
 *              clearly saturated hue names the element on its own; 0.30 (stricter than the 0.20 ladder floor) is
 *              where a hue stops looking like a tinted grey on a large area.
 *   B2 value : >= 25 % relative luminance apart, the same number as the ladder. This survives greyscale.
 *   B3 chroma: when either scale has S < 0.30 (hue is unreliable there), their saturations differ by >= 0.30
 *              AND their luminances by >= 12 %. A dusty body next to a vivid one reads as "different" by chroma
 *              alone, but two colours that also share a value would still merge in a crowd, so value must help.
 * Gate (f) applies the same rule to the simulated colours: a body pair is a body pair however it is seen.
 */
const B_SAT = 0.3;
const B_DSAT = 0.3;
const B_LUM_WITH_DSAT = 0.12;
/** Gate (j): the least scale saturation any stage may grey to (dusk too: its elder curve is capped to keep it). */
const ID_SAT = 0.3;
/** The engine's far-side defaults (rig.ts FAR_SHADE / FAR_DESAT), which gate (c) is written against. */
const ENGINE_FAR = { shade: 0.62, desat: 0.25 };
/**
 * The floors of gates (i) and (Ki): every surface a dragon or a keeper stands on (src/game/surfaces.ts FLOORS), each a
 * pale, low-saturation floor. The seven bodies span luminance 0.05..0.49 on purpose (see gate (b)), so only a light
 * floor can sit >= 25 % from all of them, and every belly must then sit <= 0.50 or >= 0.90 in luminance. The straw,
 * #e0d6b8, is the reference habitat floor (bible 5.4).
 */
const FLOOR_LIST: readonly (readonly [string, string])[] = Object.entries(FLOORS);
/** A floor's saturation ceiling: hue never counts on a floor, so it must not carry one. */
const FLOOR_S_MAX = 0.2;
/** Elements whose head carries a PAIRED horn, so a far horn is drawn against the near head (bible section 3). */
const PAIRED_HORNS: readonly DragonElement[] = ['fire', 'spike', 'lightning'];
/**
 * Elements whose legs are narrower than the engine's FLAT_R (5) at every stage, so no near leg ever gets a shadow band
 * and c2 compares the far leg against the near leg's base only. Slinkwing's leg radius is x0.75 and dusk's x0.76
 * (bible 2.3): their shadow tones sit too near the ink for a far leg to clear both by OKL_MIN.
 */
const FLAT_LEGS: readonly DragonElement[] = ['slinkwing', 'dusk'];
const STAGES = AGE_STAGES;
const NS = STAGES.length;

// ---------- colour maths ----------
function lin(c: number): number { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
/** WCAG relative luminance of an sRGB hex. */
function lumOf(hex: string): number { const [r, g, b] = hexToRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
/** |La - Lb| / max(La, Lb). */
function relDiff(a: string, b: string): number {
  const la = lumOf(a), lb = lumOf(b), m = Math.max(la, lb);
  return m > 0 ? Math.abs(la - lb) / m : 0;
}
/** Oklab lightness x 100 (Ottosson 2020). */
function okL(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 100 * (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s);
}
const okDiff = (a: string, b: string): number => Math.abs(okL(a) - okL(b));
/** Oklab (L, a, b), L in 0..1 (Ottosson 2020). */
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
/** Oklab dE (Euclidean), the perceptual distance: about 0.02 is a just-noticeable difference. */
function okDE(a: string, b: string): number { const A = oklab(a), B = oklab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }
interface Hsv { h: number; s: number; v: number; }
function hsvOf(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: mx > 0 ? d / mx : 0, v: mx };
}
function hueDelta(a: string, b: string): number {
  const d = Math.abs(hsvOf(a).h - hsvOf(b).h) % 360;
  return d > 180 ? 360 - d : d;
}
function chromatic(hex: string): boolean { const c = hsvOf(hex); return c.s >= CHROMA_S && c.v >= CHROMA_V; }

/** The linear-RGB dichromacy matrices of Vienot, Brettel & Mollon (1999). */
const CVD: Readonly<Record<'deutan' | 'protan', readonly number[]>> = {
  deutan: [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1],
  protan: [0.11238, 0.88762, 0, 0.11238, 0.88762, 0, 0.00401, -0.00401, 1],
};
function unlin(v: number): number { const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); }
function simulate(hex: string, kind: 'deutan' | 'protan'): string {
  const [r, g, b] = hexToRgb(hex).map(lin), m = CVD[kind];
  const out = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b].map(unlin);
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}

// ---------- the measurements every gate shares ----------
interface Measure { lum: number; hue: number | null; pass: boolean; by: string; }
/** The house ladder: >= 25 % luminance OR >= 40 deg hue between two chromatic colours. */
function ladder(a: string, b: string): Measure {
  const lum = relDiff(a, b);
  const hue = chromatic(a) && chromatic(b) ? hueDelta(a, b) : null;
  const byLum = lum >= LUM_MIN, byHue = hue != null && hue >= HUE_MIN;
  return { lum, hue, pass: byLum || byHue, by: byLum && byHue ? 'lum+hue' : byLum ? 'lum' : byHue ? 'HUE ONLY' : '' };
}
interface BodyMeasure {
  lum: number; hue: number; dS: number; sa: number; sb: number; dL: number; dE: number;
  pass: boolean; hueOnly: boolean; valueOnly: boolean; underFloor: boolean; by: string; margin: number;
}
/**
 * RULE_B between two body colours (gates b and f). `margin` >= 1 passes: the best rule's slack, as a fraction of its
 * bar. With `floor` (gate b), B2 also needs the dark-pair floor: >= OKL_MIN Oklab L or >= OKDE_MIN Oklab dE apart.
 * `underFloor` marks a pair that passes (or would pass) on B2 alone while under that floor (gate f reports it).
 */
function ruleB(a: string, b: string, floor = false): BodyMeasure {
  const ha = hsvOf(a), hb = hsvOf(b);
  const lum = relDiff(a, b), hue = hueDelta(a, b), dS = Math.abs(ha.s - hb.s), dL = okDiff(a, b), dE = okDE(a, b);
  const b1 = ha.s >= B_SAT && hb.s >= B_SAT && hue >= HUE_MIN;
  const clear = dL >= OKL_MIN || dE >= OKDE_MIN;
  const b2lum = lum >= LUM_MIN, b2 = b2lum && (!floor || clear);
  const low = ha.s < B_SAT || hb.s < B_SAT;
  const b3 = low && dS >= B_DSAT && lum >= B_LUM_WITH_DSAT;
  const by = [b1 ? 'B1' : '', b2 ? 'B2' : '', b3 ? 'B3' : ''].filter(Boolean).join('+');
  const fl = Math.max(dL / OKL_MIN, dE / OKDE_MIN);
  const m1 = Math.min(Math.min(ha.s, hb.s) / B_SAT, hue / HUE_MIN), m2 = floor ? Math.min(lum / LUM_MIN, fl) : lum / LUM_MIN;
  const m3 = low ? Math.min(dS / B_DSAT, lum / B_LUM_WITH_DSAT) : 0;
  const valueOnly = b2lum && !b1 && !b3;
  return { lum, hue, dS, sa: ha.s, sb: hb.s, dL, dE, pass: b1 || b2 || b3, hueOnly: b1 && !b2lum && !b3, valueOnly, underFloor: valueOnly && !clear, by, margin: Math.max(m1, m2, m3) };
}
const pct = (v: number): string => `${Math.round(v * 100)}%`.padStart(4);
const deg = (v: number | null): string => (v == null ? '  n/a' : `${Math.round(v)}deg`.padStart(5));
const okf = (v: number): string => `okL ${v.toFixed(1)}`.padStart(8);
/** One number per stage, "33/32/31/27", a failing stage marked "!" and a stage the pair does not exist at "-". */
function perStage(vals: readonly (number | null)[], oks: readonly (boolean | null)[], fmt: (v: number) => string): string {
  return vals.map((v, i) => (v == null ? '-' : fmt(v) + (oks[i] === false ? '!' : ''))).join('/');
}
const n100 = (v: number): string => String(Math.round(v * 100));

// ---------- report plumbing ----------
const out: string[] = [];
let gates = 0, failures = 0;
const failed: string[] = [];
function count(label: string, ok: boolean): boolean {
  gates++;
  if (!ok) { failures++; failed.push(label); }
  return ok;
}
function head(title: string): void { out.push('', title); }

// ---------- colour references: a slot, a slot's cel tone, or a shared / derived colour ----------
type Tone = 'hi' | 'sh' | 'deep';
/**
 * What a pair names: `scale`, `scale.sh`, `ink` (the outline), `blush`, a mood tone (`banked`, `dimSpot`), dusk's
 * `smokeBand` (the slate step of its tail tip's fade), or an elder face colour (`muzzle`: the grey muzzle; `tuft`:
 * the brow tuft, the muzzle's grey but on water and rock; `beard`: the beard; `frost`: slinkwing's frosted fan tips). Tones come from dragonTones, so `scale.hi` is the
 * silvered highlight of an adult or elder.
 */
type Ref = DragonSlot | `${DragonSlot}.${Tone}` | 'ink' | 'blush' | 'banked' | 'dimSpot' | 'muzzle' | 'tuft' | 'beard' | 'frost' | 'smokeBand';
const PAL = (e: DragonElement, st: AgeStage): Readonly<DragonPalette> => agedPalette(e, st);
const S = DRAGON_SHARED;
function colour(e: DragonElement, st: AgeStage, ref: Ref): string {
  if (ref === 'ink') return S.outline;
  if (ref === 'blush') return blushOf(e);
  if (ref === 'banked' || ref === 'dimSpot') return moodTones(PAL(e, st))[ref];
  if (ref === 'muzzle') return muzzleOf(PAL(e, st), e);
  if (ref === 'tuft') return tuftOf(PAL(e, st), e);
  if (ref === 'beard') return beardOf(PAL(e, st), e);
  if (ref === 'frost') return fanFrostOf(PAL(e, st), e);
  if (ref === 'smokeBand') return smokeBandOf(PAL(e, st));
  const [slot, tone] = ref.split('.') as [DragonSlot, Tone | undefined];
  return tone ? dragonTones(e, slot, RAMP, st)[tone] : PAL(e, st)[slot];
}

// ---------- adjacency: which colours touch on the sprite ----------
/** `except`: an element whose pair is not gated, and why (the bible's 5.6 exemption ledger: E15, rock's white beard). */
interface Pair { a: Ref; b: Ref; why: string; except?: Readonly<Partial<Record<DragonElement, string>>>; }
/** The pairs every dragon has, from the part construction in the bible (section 1). */
const CORE_PAIRS: readonly Pair[] = [
  { a: 'scale', b: 'belly', why: 'belly band inside the body silhouette, no ink' },
  { a: 'scale.sh', b: 'belly.sh', why: 'the body shadow band crosses the belly line' },
  { a: 'scale', b: 'membrane', why: 'wing arm and spars over the membrane; wing over the body' },
  { a: 'scale.sh', b: 'membrane', why: 'the wing sweeps over the body shadow band in a flap' },
  { a: 'scale', b: 'horn', why: 'horns on the head, claws on the paws' },
  { a: 'scale', b: 'marking', why: 'markings clipped inside the body' },
  { a: 'scale.sh', b: 'marking', why: 'markings run through the shadow band' },
  { a: 'scale.hi', b: 'marking', why: 'markings run through the highlight band' },
  { a: 'belly', b: 'marking', why: 'markings meet the belly line' },
  { a: 'membrane', b: 'horn', why: 'thumb claw, spar thorns, fan ribs, fin rays on membrane; horn over a spread wing' },
  { a: 'scale', b: 'dark', why: 'nostril on the snout' },
];
/** Pairs only one element's construction creates (bible section 3). */
const EXTRA_PAIRS: Readonly<Record<DragonElement, readonly Pair[]>> = {
  fire: [{ a: 'glow', b: 'scale', why: 'flame sits on the tail tip' }],
  spike: [{ a: 'glow', b: 'scale', why: 'quill-volley sap streaks leave the back' }],
  rock: [
    { a: 'membrane', b: 'marking', why: 'near wing tucks under the dome rim' },
    { a: 'glow', b: 'marking', why: 'crystals grow out of the dome' },
    { a: 'horn', b: 'dark', why: 'nose horn root beside the nostril' },
  ],
  lightning: [
    { a: 'glow', b: 'horn', why: 'sparks crawl on the horn tips' },
    { a: 'glow', b: 'membrane', why: 'sparks on the bolt-wing tips' },
  ],
  water: [
    { a: 'glow', b: 'scale', why: 'spots swap to glow on the flank' },
    { a: 'glow', b: 'membrane', why: 'glow dots on the fluke lobes' },
  ],
  slinkwing: [
    { a: 'membrane', b: 'belly', why: 'throat sac swells out of the throat stripe' },
    { a: 'marking', b: 'belly', why: 'eye mask meets the chin stripe' },
    { a: 'scale.deep', b: 'marking', why: 'the brow bar sits on the eye mask' },
    { a: 'ink', b: 'marking', why: 'ink face marks (happy, closed, lids) sit on the eye mask' },
  ],
  dusk: [
    { a: 'glow', b: 'scale', why: 'the lantern hangs from the scale stalk, ahead of the head and neck' },
    { a: 'glow.hi', b: 'glow', why: 'the lantern\'s hot core (mood >= +0.5, the idle "breath")' },
    { a: 'horn', b: 'glow', why: 'the lantern\'s silver cap, bail and finial on the lamp' },
    { a: 'membrane', b: 'glow', why: 'the moth (moth-grey) visits the lamp; the elder\'s lives on its cap' },
    { a: 'dark', b: 'marking', why: 'the nostril sits on the nose frost' },
    { a: 'ink', b: 'marking', why: 'the mouth line and a closed eye\'s bar reach the nose frost' },
    { a: 'scale', b: 'smokeBand', why: 'the tail tip fades navy -> slate band -> smoke, flat steps, no ink' },
    { a: 'scale.sh', b: 'smokeBand', why: 'the tail\'s shadow band runs through the slate band' },
    { a: 'smokeBand', b: 'marking', why: 'the slate band meets the smoke tip' },
  ],
};
/** E15: rock's beard is its muzzle white, an old dog's white chin tuft, held off the cream stripe and the straw by its ink. */
const ROCK_BEARD = 'the muzzle white, inked on its outer contour: 5.6 E15';
/** Pairs only the ELDER has (bible 2.5, the elder face; section 3's elder-only extras). */
const ELDER_PAIRS: readonly Pair[] = [
  { a: 'muzzle', b: 'scale', why: 'the grey muzzle on the snout' },
  { a: 'tuft', b: 'scale', why: 'the brow tuft on the head (the muzzle\'s grey, or water\'s and rock\'s own pale grey)' },
  { a: 'muzzle', b: 'scale.sh', why: 'the muzzle meets the head\'s shadow band at the snout\'s front-bottom' },
  { a: 'muzzle', b: 'dark', why: 'the nostril sits on the muzzle' },
  { a: 'muzzle', b: 'ink', why: 'ink face marks (the mouth line, a closed eye\'s bar) sit on the muzzle' },
  { a: 'beard', b: 'belly', why: 'the beard sweeps back along the throat stripe (inked, but gated like a horn)', except: { rock: ROCK_BEARD } },
  { a: 'beard', b: 'belly.sh', why: 'the beard over the throat stripe\'s shadow tone', except: { rock: ROCK_BEARD } },
  { a: 'beard', b: 'scale.sh', why: 'the beard\'s root under the closed jaw\'s shadow sliver' },
  { a: 'beard', b: 'ink', why: 'the beard\'s own outline' },
];
const ELDER_EXTRA: Readonly<Partial<Record<DragonElement, readonly Pair[]>>> = {
  fire: [
    { a: 'glow.sh', b: 'glow', why: 'the hearth\'s coal bed, the flame\'s bottom 2 rows (the elder-only extra)' },
    { a: 'glow.hi', b: 'glow.sh', why: 'the lit specks in the coal bed' },
  ],
  spike: [
    { a: 'glow.sh', b: 'scale', why: 'the sap-buds (the elder-only extra) on the back between quills' },
    { a: 'glow.sh', b: 'horn', why: 'a sap-bud beside a quill\'s root' },
    { a: 'glow', b: 'glow.sh', why: 'the lit bud over its calyx (its base row)' },
  ],
  rock: [{ a: 'muzzle', b: 'horn', why: 'the nose horn rises from the pale stone muzzle' }],
  slinkwing: [
    { a: 'muzzle', b: 'marking', why: 'the muzzle meets the lilac eye mask' },
    { a: 'frost', b: 'membrane', why: 'the frosted tips along the near fan\'s top edge' },
    { a: 'frost', b: 'membrane.sh', why: 'the frost band crosses the elder fan\'s pleats' },
  ],
};
/** Colours a mood swaps between (gate h). */
const MOOD_PAIRS: Readonly<Partial<Record<DragonElement, readonly Pair[]>>> = {
  fire: [{ a: 'glow', b: 'banked', why: 'asleep, the flame banks to glow.sh' }],
  rock: [
    { a: 'glow', b: 'banked', why: 'lit crystals vs dim crystals (mood <= -0.3)' },
    { a: 'banked', b: 'marking', why: 'a dim crystal still reads on the dome' },
  ],
  water: [
    { a: 'marking', b: 'dimSpot', why: 'spots dim when dry or sad' },
    { a: 'marking', b: 'glow', why: 'spots light up when happy' },
    { a: 'dimSpot', b: 'scale', why: 'dim spots still read on the flank' },
  ],
  dusk: [
    { a: 'glow', b: 'banked', why: 'the lit crescent vs the lamp\'s dark face (mood <= -0.3, asleep)' },
    { a: 'banked', b: 'ink', why: 'the dark face still reads inside the lamp\'s ink ring' },
    { a: 'banked', b: 'scale', why: 'a turned-down lamp still reads against the stalk and head' },
  ],
};
/**
 * The outer colour of every effect that lands on the floor (gate i), by element, plus what else lies on it: a
 * marking that runs along the silhouette's edge (dusk's smoke tail tip and band: a tail lies on the floor), dusk's
 * lamp resting on the floor asleep (its dark face), and (`only` elder) the beard a sleeping elder rests its chin on.
 */
interface FloorItem { what: string; ref: Ref; only?: AgeStage; except?: Readonly<Partial<Record<DragonElement, string>>>; }
/**
 * (`except`: an element whose item is not gated, and why: the bible's 5.6 exemption ledger. E14: water's elder beard is its
 * pale frost muzzle's grey, 0.65, grown from the grey chin: its belly and the floor are 0.48 and 0.67, so one grey
 * clears the belly only at >= 0.64 and the floor only at <= 0.50 or >= 0.89, and the frost at 0.92 made the stark
 * white snout and a white tusk under it (cast review v2). On the straw it rests inside its own 1 px ink ring.)
 */
const FLOOR_ALL: readonly FloorItem[] = [{ what: 'beard', ref: 'beard', only: 'elder', except: { water: 'inked on its outer contour: 5.6 E14', rock: ROCK_BEARD } }];
const FLOOR_FX: Readonly<Record<DragonElement, readonly FloorItem[]>> = {
  fire: [{ what: 'breath puff outer ring', ref: 'scale' }],
  spike: [{ what: 'sap streak / sparkle edge', ref: 'scale' }],
  rock: [{ what: 'dust puff (opaque)', ref: 'scale' }, { what: 'adult roar puff ring', ref: 'scale.sh' }, { what: 'pebble', ref: 'marking' }],
  lightning: [{ what: 'spark ring', ref: 'scale' }],
  water: [{ what: 'bubble / drip ring', ref: 'membrane' }],
  slinkwing: [{ what: 'sound arc', ref: 'membrane' }, { what: 'sound arc edge', ref: 'scale' }],
  dusk: [
    { what: 'mist lobe (opaque)', ref: 'membrane' }, { what: 'mist ring', ref: 'scale' }, { what: 'smoke tail tip', ref: 'marking' },
    { what: 'slate band', ref: 'smokeBand' }, { what: 'nightlight dark face', ref: 'banked' },
  ],
};

out.push('DRAGON PALETTE CHECK  (tools/palette-check.ts)');
out.push(`ladder: >= ${LUM_MIN * 100}% rel. luminance OR >= ${HUE_MIN}deg hue (hue counts only when S >= ${CHROMA_S} and V >= ${CHROMA_V})`);
out.push(`stages: ${STAGES.join(' / ')} (b/y/a/e), each the base palette greyed by agedPalette (bible 3.9); one number per stage is one gate, "!" marks a failing stage`);

// (a) -----------------------------------------------------------------------------------------------------
head('(a) ADJACENT COLOURS WITHIN EACH DRAGON  (lum % b/y/a/e, hue deg b/y/a/e; hexes at baby -> elder)');
/** One adjacency pair at every stage it exists at (`only`: elder-only pairs). */
function pairLine(e: DragonElement, a: Ref, b: Ref, only?: AgeStage): void {
  const lums: (number | null)[] = [], hues: (number | null)[] = [], oks: (boolean | null)[] = [], bys = new Set<string>();
  let allOk = true;
  for (const st of STAGES) {
    if (only && st !== only) { lums.push(null); hues.push(null); oks.push(null); continue; }
    const ca = colour(e, st, a), cb = colour(e, st, b), m = ladder(ca, cb);
    lums.push(m.lum); hues.push(m.hue); oks.push(m.pass); bys.add(m.by || 'FAIL');
    if (!count(`(a) ${e} ${st} ${a}/${b}`, m.pass)) allOk = false;
  }
  const s0 = only ?? 'baby', ends = only ? `${colour(e, s0, a)} ${colour(e, s0, b)}` : `${colour(e, 'baby', a)} ${colour(e, 'baby', b)} -> ${colour(e, 'elder', a)} ${colour(e, 'elder', b)}`;
  const hueTxt = hues.every((h) => h == null) ? 'n/a' : perStage(hues.map((h, i) => (lums[i] == null ? null : h ?? -1)), oks, (v) => (v < 0 ? 'n/a' : String(Math.round(v))));
  out.push(`${allOk ? '  ok  ' : '  FAIL'} ${(a + '/' + b).padEnd(19)} lum ${perStage(lums, oks, n100).padEnd(15)} hue ${hueTxt.padEnd(15)} ${[...bys].join(',').padEnd(12)} ${ends}`);
}
for (const e of DRAGON_ELEMENTS) {
  out.push(` ${e}`);
  for (const pr of [...CORE_PAIRS, ...EXTRA_PAIRS[e]]) pairLine(e, pr.a, pr.b);
  // the face: iris against the 2x2 catchlight (adult catchlights sit on the iris) and against the pupil (the iris
  // never greys, so these hold at every stage), and the blush, which sits on the cheek scale
  for (const [name, get] of [
    ['eye/catchlight', (st: AgeStage) => [PAL(e, st).eye, S.catchlight]],
    ['eye/pupil', (st: AgeStage) => [PAL(e, st).eye, S.pupil]],
    ['blush/scale', (st: AgeStage) => [blushOf(e), PAL(e, st).scale]],
  ] as const) {
    const lums: number[] = [], oks: boolean[] = [];
    let allOk = true;
    for (const st of STAGES) {
      const [a, b] = get(st), m = ladder(a, b);
      lums.push(m.lum); oks.push(m.pass);
      if (!count(`(a) ${e} ${st} ${name}`, m.pass)) allOk = false;
    }
    const [a0, b0] = get('baby'), [a3, b3] = get('elder');
    out.push(`${allOk ? '  ok  ' : '  FAIL'} ${name.padEnd(19)} lum ${perStage(lums, oks, n100).padEnd(15)} hue ${'-'.padEnd(15)} ${'lum'.padEnd(12)} ${a0} ${b0}${a3 !== a0 || b3 !== b0 ? ` -> ${a3} ${b3}` : ''}`);
  }
  for (const pr of [...ELDER_PAIRS, ...(ELDER_EXTRA[e] ?? [])]) {
    const ex = pr.except?.[e];
    if (ex) out.push(`  ex   ${(pr.a + '/' + pr.b).padEnd(19)} exempt (${ex})`);
    else pairLine(e, pr.a, pr.b, 'elder');
  }
}
out.push(' shared');
for (const [name, a, b] of [['mouth/tongue', S.mouth, S.tongue], ['mouth/fang', S.mouth, S.catchlight]] as const) {
  const m = ladder(a, b);
  count(`(a) shared ${name}`, m.pass);
  out.push(`${m.pass ? '  ok  ' : '  FAIL'} ${name.padEnd(19)} ${a} ${b}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  ${m.by}`);
}

// (b) and (f) -------------------------------------------------------------------------------------------------
/** Body pairs (gate f) that pass on simulated value alone while under the dark-pair floor: reported in (g). */
const underFloor: string[] = [];
/**
 * A body pair across all 16 stage combinations: the pass count and the thinnest combination. `floor` (gate b) holds a
 * value-only (B2) pass to the dark-pair floor; without it (gate f) such passes are collected in `underFloor`.
 */
function bodyPairLine(tag: string, ea: DragonElement, eb: DragonElement, see: (hex: string) => string, floor: boolean): string {
  let pass = 0, worst: { m: BodyMeasure; sa: AgeStage; sb: AgeStage; a: string; b: string } | null = null;
  let under: { m: BodyMeasure; sa: AgeStage; sb: AgeStage; a: string; b: string } | null = null;
  const bad: string[] = [];
  for (const sa of STAGES) for (const sb of STAGES) {
    const a = see(PAL(ea, sa).scale), b = see(PAL(eb, sb).scale), m = ruleB(a, b, floor);
    if (count(`${tag} ${ea}.${sa}/${eb}.${sb}`, m.pass)) pass++; else bad.push(`${sa[0]}${sb[0]}`);
    if (!worst || m.margin < worst.m.margin) worst = { m, sa, sb, a, b };
    if (!floor && m.underFloor && (!under || Math.max(m.dL / OKL_MIN, m.dE / OKDE_MIN) < Math.max(under.m.dL / OKL_MIN, under.m.dE / OKDE_MIN))) under = { m, sa, sb, a, b };
  }
  if (under) underFloor.push(`${tag.replace('(f) ', '')} ${ea}/${eb} ${under.sa}/${under.sb} ${under.a} ${under.b} lum ${pct(under.m.lum)} dL ${under.m.dL.toFixed(1)} dE ${under.m.dE.toFixed(3)}`);
  const w = worst!, same = STAGES.map((st) => ruleB(see(PAL(ea, st).scale), see(PAL(eb, st).scale), floor));
  const fl = w.m.by === 'B2' && floor ? ` (okL ${w.m.dL.toFixed(1)} dE ${w.m.dE.toFixed(3)})` : '';
  return `${bad.length ? '  FAIL' : '  ok  '} ${(ea + '/' + eb).padEnd(19)} ${String(pass).padStart(2)}/${NS * NS}  same stage lum ${perStage(same.map((m) => m.lum), same.map((m) => m.pass), n100).padEnd(12)}`
    + ` thinnest ${w.sa}/${w.sb} ${w.a} ${w.b} lum ${pct(w.m.lum)} hue ${deg(w.m.hue)} S ${w.m.sa.toFixed(2)}/${w.m.sb.toFixed(2)} ${w.m.by || 'FAIL'}${fl}${bad.length ? '  failing (stage of ' + ea + ', of ' + eb + '): ' + bad.join(' ') : ''}`;
}
head(`(b) SCALE COLOURS ACROSS ELEMENTS, AT EVERY PAIR OF STAGES  (B1 hue: both S>=0.30 and >=40deg | B2 value: >=25% and (okL >= ${OKL_MIN} or dE >= ${OKDE_MIN}) | B3 chroma: dS>=0.30 and >=12%; ${NS * NS} stage combinations a pair)`);
const hueOnly: string[] = [];
for (let i = 0; i < DRAGON_ELEMENTS.length; i++) {
  for (let j = i + 1; j < DRAGON_ELEMENTS.length; j++) {
    const ea = DRAGON_ELEMENTS[i], eb = DRAGON_ELEMENTS[j];
    out.push(bodyPairLine('(b)', ea, eb, (h) => h, true));
    for (const st of STAGES) if (ruleB(PAL(ea, st).scale, PAL(eb, st).scale, true).hueOnly) hueOnly.push(`${ea}/${eb} (${st})`);
  }
}
for (const st of STAGES) {
  const stack = [...DRAGON_ELEMENTS].map((e) => ({ e, L: lumOf(PAL(e, st).scale), s: hsvOf(PAL(e, st).scale).s })).sort((x, y) => y.L - x.L);
  out.push(` ${st.padEnd(6)} value stack (L / S): ${stack.map((x) => `${x.e} ${x.L.toFixed(3)}/${x.s.toFixed(2)}`).join(' > ')}`);
}

// (c) -----------------------------------------------------------------------------------------------------
head(`(c) FAR SIDE vs NEAR SCALE  (>= ${LUM_MIN * 100}% luminance; hue does not count, far parts share the near hue; % b/y/a/e)`);
/** One far-side comparison at every stage: far[slot] from farPalette(p, shade, desat) against a near tone of the scale. */
function farGate(e: DragonElement, tag: string, shade: number, desat: number, slot: DragonSlot, near: 'base' | 'sh', ok = false): string {
  const ds: number[] = [], oks: boolean[] = [];
  let minO = 99;
  for (const st of STAGES) {
    const pal = PAL(e, st), far = farPalette(pal, shade, desat)[slot];
    const ref = near === 'base' ? pal.scale : dragonTones(e, 'scale', RAMP, st).sh;
    const d = relDiff(far, ref), o = okDiff(far, ref), pass = d >= LUM_MIN && (!ok || o >= OKL_MIN);
    ds.push(d); oks.push(pass); minO = Math.min(minO, o);
    count(`(c) ${e} ${st} ${tag} far ${slot} vs near scale.${near}`, pass);
  }
  const far0 = farPalette(PAL(e, 'baby'), shade, desat)[slot];
  return `${slot} ${far0}${near === 'sh' ? ' vs sh' : ''} ${perStage(ds, oks, n100)}%${ok ? ' min ' + okf(minO) : ''}${oks.every(Boolean) ? '' : ' FAIL'}`;
}
const L = DRAGON_FAR.legs, W = DRAGON_FAR.wingAndHead;
out.push(` c1  engine default farPalette(p, ${ENGINE_FAR.shade}, ${ENGINE_FAR.desat}): far scale and far membrane vs near scale`);
for (const e of DRAGON_ELEMENTS) {
  out.push(`        ${e.padEnd(10)} ${farGate(e, 'c1', ENGINE_FAR.shade, ENGINE_FAR.desat, 'scale', 'base')}   ${farGate(e, 'c1', ENGINE_FAR.shade, ENGINE_FAR.desat, 'membrane', 'base')}`);
}
out.push(` c2  rig far LEGS farPalette(p, ${L.shade}, ${L.desat}): far leg vs near leg base, and vs near leg SHADOW band (scale.sh); >= ${LUM_MIN * 100}% and >= okL ${OKL_MIN}`);
for (const e of DRAGON_ELEMENTS) {
  const base = farGate(e, 'c2', L.shade, L.desat, 'scale', 'base', true);
  const sh = FLAT_LEGS.includes(e) ? '(legs flat at every stage: no shadow band to cross)' : farGate(e, 'c2', L.shade, L.desat, 'scale', 'sh', true);
  out.push(`        ${e.padEnd(10)} ${base}   ${sh}`);
}
out.push(` c3  rig far WING + HEAD features farPalette(p, ${W.shade}, ${W.desat}): far membrane (wing, ear-fan, fin-ear) and far paired horn vs near scale`);
for (const e of DRAGON_ELEMENTS) {
  const cells = [farGate(e, 'c3', W.shade, W.desat, 'membrane', 'base')];
  if (PAIRED_HORNS.includes(e)) cells.push(farGate(e, 'c3', W.shade, W.desat, 'horn', 'base'));
  out.push(`        ${e.padEnd(10)} ${cells.join('   ')}${PAIRED_HORNS.includes(e) ? '' : '   (no paired horns)'}`);
}

// (d) -----------------------------------------------------------------------------------------------------
head('(d) CEL RAMPS  (engine makeTones on each stage\'s greyed colours, default RAMP: hi 1.22 / sh 0.66 / deep 0.51)');
let weakest = { step: 9, where: '' };
for (const e of DRAGON_ELEMENTS) {
  const bad: string[] = [];
  for (const st of STAGES) for (const s of DRAGON_SLOTS) {
    const t = dragonTones(e, s, RAMP, st);
    const collapsed = t.sh === t.base || t.hi === t.base || t.sh === t.hi || t.deep === t.sh;
    if (!count(`(d) ${e} ${st} ${s}`, !collapsed)) bad.push(`${st} ${s}`);
    if (s !== 'glow' && s !== 'eye' && s !== 'dark') {
      const step = relDiff(t.hi, t.base);
      if (step < weakest.step) weakest = { step, where: `${e}.${s} (${st}) ${t.base} -> hi ${t.hi}` };
    }
  }
  out.push(`${bad.length ? '  FAIL' : '  ok  '} ${e.padEnd(10)} ${DRAGON_SLOTS.length * NS} ramps distinct (8 slots x ${NS} stages)${bad.length ? '; collapsed: ' + bad.join(', ') : ''}`);
}
out.push(`        weakest highlight step on a banded slot: ${pct(weakest.step)} (${weakest.where})`);
for (const e of DRAGON_ELEMENTS) {
  const o = DRAGON_SHADOW[e];
  if (!o) continue;
  for (const s of DRAGON_SLOTS) {
    if (!o[s]) continue;
    const ds: number[] = [], oks: boolean[] = [];
    for (const st of STAGES) {
      const sh = dragonTones(e, s, RAMP, st).sh, d = relDiff(sh, PAL(e, st)[s]);
      ds.push(d); oks.push(count(`(d) ${e} ${st} ${s} hand-set shadow`, d >= LUM_MIN));
    }
    out.push(`${oks.every(Boolean) ? '  ok  ' : '  FAIL'} ${e.padEnd(10)} hand-set ${s}.sh ${o[s]} (engine ${toneOf(PAL(e, 'baby')[s], RAMP.sh)}) ${perStage(ds, oks, n100)}% under its base -> elder ${dragonTones(e, s, RAMP, 'elder').sh}`);
  }
}

// (e) -----------------------------------------------------------------------------------------------------
head(`(e) INK FLOOR  (far leg scale, far wing membrane and far paired horn vs outline ${S.outline}: >= ${LUM_MIN * 100}% and >= okL ${OKL_MIN}; % b/y/a/e, least okL)`);
for (const e of DRAGON_ELEMENTS) {
  const parts: [string, (p: DragonPalette) => string][] = [
    ['far leg scale', (p) => farPalette(p, L.shade, L.desat).scale],
    ['far membrane', (p) => farPalette(p, W.shade, W.desat).membrane],
  ];
  if (PAIRED_HORNS.includes(e)) parts.push(['far horn', (p) => farPalette(p, W.shade, W.desat).horn]);
  const cells: string[] = [];
  let allOk = true;
  for (const [name, get] of parts) {
    const ds: number[] = [], oks: boolean[] = [];
    let minO = 99;
    for (const st of STAGES) {
      const hex = get({ ...PAL(e, st) }), d = relDiff(hex, S.outline), o = okDiff(hex, S.outline), ok = d >= LUM_MIN && o >= OKL_MIN;
      ds.push(d); oks.push(ok); minO = Math.min(minO, o);
      if (!count(`(e) ${e} ${st} ${name}`, ok)) allOk = false;
    }
    cells.push(`${name} ${get({ ...PAL(e, 'baby') })} ${perStage(ds, oks, n100)}% ${okf(minO)}`);
  }
  out.push(`${allOk ? '  ok  ' : '  FAIL'} ${e.padEnd(10)} ${cells.join('   ')}`);
}

// (f) -----------------------------------------------------------------------------------------------------
head(`(f) COLOUR-BLIND SAFETY  (simulated deuteranopia / protanopia, Vienot 1999: body pairs by RULE_B at all ${NS * NS} stage combinations, blush/scale by the ladder)`);
for (const k of ['deutan', 'protan'] as const) {
  out.push(` ${k}`);
  for (let i = 0; i < DRAGON_ELEMENTS.length; i++) {
    for (let j = i + 1; j < DRAGON_ELEMENTS.length; j++) out.push(bodyPairLine(`(f) ${k}`, DRAGON_ELEMENTS[i], DRAGON_ELEMENTS[j], (h) => simulate(h, k), false));
  }
  for (const e of DRAGON_ELEMENTS) {
    const lums: number[] = [], oks: boolean[] = [];
    for (const st of STAGES) {
      const m = ladder(simulate(blushOf(e), k), simulate(PAL(e, st).scale, k));
      lums.push(m.lum); oks.push(count(`(f) ${k} ${e} ${st} blush/scale`, m.pass));
    }
    out.push(`${oks.every(Boolean) ? '  ok  ' : '  FAIL'} ${(e + ' blush/scale').padEnd(22)} lum ${perStage(lums, oks, n100)}%  ${simulate(blushOf(e), k)} on ${simulate(PAL(e, 'baby').scale, k)} -> ${simulate(PAL(e, 'elder').scale, k)}`);
  }
}

// (h) -----------------------------------------------------------------------------------------------------
head('(h) MOOD STATES  (colours a mood swaps between; the ladder, so the change is visible; lum % b/y/a/e)');
for (const e of DRAGON_ELEMENTS) {
  const pairs = MOOD_PAIRS[e];
  if (!pairs) continue;
  out.push(` ${e}`);
  for (const pr of pairs) {
    const lums: number[] = [], oks: boolean[] = [], bys = new Set<string>();
    for (const st of STAGES) {
      const m = ladder(colour(e, st, pr.a), colour(e, st, pr.b));
      lums.push(m.lum); oks.push(count(`(h) ${e} ${st} ${pr.a}/${pr.b}`, m.pass)); bys.add(m.by || 'FAIL');
    }
    out.push(`${oks.every(Boolean) ? '  ok  ' : '  FAIL'} ${(pr.a + '/' + pr.b).padEnd(19)} lum ${perStage(lums, oks, n100).padEnd(15)} ${[...bys].join(',').padEnd(10)} ${colour(e, 'baby', pr.a)} ${colour(e, 'baby', pr.b)}  (${pr.why})`);
  }
}

// (i) -----------------------------------------------------------------------------------------------------
for (const [floorName, floorHex] of FLOOR_LIST) {
  const fs = hsvOf(floorHex).s, sOk = count(`(i) ${floorName} saturation < ${FLOOR_S_MAX.toFixed(2)}`, fs < FLOOR_S_MAX);
  head(`(i) HABITAT FLOOR ${floorName} ${floorHex}  (L ${lumOf(floorHex).toFixed(2)}, S ${fs.toFixed(2)}: hue never counts, >= ${LUM_MIN * 100}% luminance; % b/y/a/e)`);
  out.push(`${sOk ? '  ok  ' : '  FAIL'} saturation ${fs.toFixed(3)} < ${FLOOR_S_MAX.toFixed(2)}`);
  for (const e of DRAGON_ELEMENTS) {
    const cells: string[] = [];
    let allOk = true;
    const items: FloorItem[] = [{ what: 'scale', ref: 'scale' }, { what: 'belly', ref: 'belly' }, ...FLOOR_FX[e], ...FLOOR_ALL];
    for (const it of items) {
      const ex = it.except?.[e];
      if (ex) { cells.push(`${it.what} exempt (${ex})`); continue; }
      const ds: (number | null)[] = [], oks: (boolean | null)[] = [];
      for (const st of STAGES) {
        if (it.only && st !== it.only) { ds.push(null); oks.push(null); continue; }
        const d = relDiff(colour(e, st, it.ref), floorHex);
        ds.push(d); oks.push(d >= LUM_MIN);
        if (!count(`(i) ${floorName} ${e} ${st} ${it.what}`, d >= LUM_MIN)) allOk = false;
      }
      cells.push(`${it.what} ${perStage(ds, oks, n100)}%`);
    }
    out.push(`${allOk ? '  ok  ' : '  FAIL'} ${e.padEnd(10)} ${cells.join('  ')}`);
  }
}

// (j) -----------------------------------------------------------------------------------------------------
head(`(j) IDENTITY THROUGH AGE  (every stage's scale keeps HSV S >= ${ID_SAT}; scale k b/y/a/e from palettes.ts ageK)`);
for (const e of DRAGON_ELEMENTS) {
  const min = ID_SAT, ss: number[] = [], oks: boolean[] = [];
  for (const st of STAGES) {
    const s = hsvOf(PAL(e, st).scale).s;
    ss.push(s); oks.push(count(`(j) ${e} ${st} scale S`, s >= min - 1e-9));
  }
  out.push(`${oks.every(Boolean) ? '  ok  ' : '  FAIL'} ${e.padEnd(10)} scale S ${perStage(ss, oks, (v) => v.toFixed(2))}  (>= ${min.toFixed(2)})  k ${STAGES.map((st) => ageK(e, st, 'scale').toFixed(2)).join('/')}  ${STAGES.map((st) => PAL(e, st).scale).join(' ')}`);
}

// (k) -----------------------------------------------------------------------------------------------------
head(`(k) VISIBLE GREYING  (each greying step young -> adult and adult -> elder moves the scale or its silvered highlight band (AGE_SILVER ${STAGES.map((st) => AGE_SILVER[st]).join('/')}; rock's, lightning's and slinkwing's elders ${ageSilver('lightning', 'elder')}) by >= ${GREY_STEP} Oklab dE; dE scale / hi per step)`);
for (const e of DRAGON_ELEMENTS) {
  const cells: string[] = [];
  let allOk = true;
  for (const [s0, s1] of [['young', 'adult'], ['adult', 'elder']] as const) {
    const dS = okDE(PAL(e, s0).scale, PAL(e, s1).scale), dH = okDE(dragonTones(e, 'scale', RAMP, s0).hi, dragonTones(e, 'scale', RAMP, s1).hi);
    const ok = Math.max(dS, dH) >= GREY_STEP;
    if (!count(`(k) ${e} ${s0}->${s1}`, ok)) allOk = false;
    cells.push(`${s0[0]}>${s1[0]} ${dS.toFixed(3)} / ${dH.toFixed(3)}${ok ? '' : '!'}`);
  }
  const his = STAGES.map((st) => dragonTones(e, 'scale', RAMP, st).hi);
  out.push(`${allOk ? '  ok  ' : '  FAIL'} ${e.padEnd(10)} ${cells.join('   ')}   hi ${his.join(' ')}`);
}

// (g) -----------------------------------------------------------------------------------------------------
head('(g) REPORTED, NOT GATED');
out.push(` scale pairs passing (b) on hue only at the same stage, so they would merge in greyscale: ${hueOnly.length ? hueOnly.join(', ') : 'none'}`);
out.push(` body pairs passing (f) on simulated value alone under the dark-pair floor (okL < ${OKL_MIN} and dE < ${OKDE_MIN}; told apart by zone):`);
if (underFloor.length) for (const u of underFloor) out.push(`   ${u}`); else out.push('   none');
out.push(' glow pairs across elements within 40deg hue AND 25% luminance (must differ by effect SHAPE; the glow never greys):');
let glowClose = 0;
for (let i = 0; i < DRAGON_ELEMENTS.length; i++) {
  for (let j = i + 1; j < DRAGON_ELEMENTS.length; j++) {
    const ea = DRAGON_ELEMENTS[i], eb = DRAGON_ELEMENTS[j], ga = PAL(ea, 'baby').glow, gb = PAL(eb, 'baby').glow, m = ladder(ga, gb);
    if (!m.pass) { glowClose++; out.push(`   ${(ea + '/' + eb).padEnd(22)} ${ga} ${gb}  lum ${pct(m.lum)}  hue ${deg(m.hue)}`); }
  }
}
if (!glowClose) out.push('   none');

// ---------- the keepers (docs/KEEPERS.md 3) ----------
// The keepers' palettes (src/art/keeper/palettes.ts) under the same maths, counted apart from the dragons' gates:
//   (Ka) adjacency : every pair of colours that touch on a keeper passes the house ladder (the pairs below, with where
//                    they touch), the bowl in Bea's hands and Tomas's brush in his among them;
//   (Kd) ramps     : makeTones keeps shadow != base != highlight for every slot; the hand-set skin shadow
//                    (KEEPER_SKIN_SHADOW) sits >= 25 % luminance under its skin;
//   (Kc) far side  : the far arm and leg (farPalette at KEEPER_FAR) keep >= 25 % luminance from the near side;
//   (Ke) ink floor : and >= 25 % luminance AND >= OKL_MIN Oklab L from the outline;
//   (Ki) floor     : the shoes and the trousers or skirt keep >= 25 % luminance from every floor (FLOORS);
//   (Kf) told apart: the four keepers' tops pass RULE_B pairwise, as they are and under simulated deuteranopia and
//                    protanopia (a player tells the keepers apart across the yard by the top first);
//   (Kg) at work   : the night keeper's trousers and cardigan pass the ladder against dusk's scale at every stage
//                    (kneeling at its side for its own tuck-in, her legs lie over its body: slate, they merged).
let kGates = 0, kFailures = 0;
const kFailed: string[] = [];
function kcount(label: string, ok: boolean): boolean {
  kGates++;
  if (!ok) { kFailures++; kFailed.push(label); }
  return ok;
}
type KSlot = keyof KeeperPalette | 'white' | 'bowl';
const kcol = (id: KeeperId, slot: KSlot): string | undefined =>
  slot === 'white' ? KEEPER_SHARED.white : slot === 'bowl' ? BOWL : (KEEPER_PALETTES[id] as Record<string, string | undefined>)[slot];
/** The pairs that touch on a keeper, and where. A pair a keeper lacks a slot for is skipped (only Bea wears an apron). */
interface KPair { a: KSlot; b: KSlot; where: string; only?: readonly KeeperId[] }
const kp = (a: KSlot, b: KSlot, where: string, only?: readonly KeeperId[]): KPair => ({ a, b, where, only });
const K_PAIRS: readonly KPair[] = [
  kp('skin', 'hair', 'hairline, brows on the face'), kp('skin', 'primary', 'the neck on the collar, a forearm over the top'),
  kp('hair', 'primary', 'the hair at the nape on the collar'), kp('primary', 'secondary', 'the top on the trousers at the waist'),
  kp('secondary', 'dark', 'the trousers on the shoes'), kp('skin', 'white', 'the eye whites on the face'), kp('glow', 'skin', 'the blush on the cheek'),
  kp('apron', 'primary', 'the apron bib on the blouse'), kp('apron', 'secondary', 'the apron skirt on the skirt'), kp('apron', 'skin', 'the hands on the apron'),
  kp('hat', 'hair', 'the hat on the hair'), kp('hat', 'skin', 'the brim over the brow'), kp('accent', 'hat', 'the band on the straw hat', ['tomas']),
  kp('accent', 'primary', 'the brace on the shirt', ['tomas']),
  kp('trim', 'hat', 'the pom-pom and the cuff on the nightcap', ['iris']), kp('trim', 'primary', 'the nightshirt between the cardigan\'s edges', ['iris']),
  kp('trim', 'primary', 'the straps on the tee', ['pip']), kp('accent', 'trim', 'the buckle on the strap', ['pip']),
  kp('tool', 'skin', 'the hand on the brush'), kp('tool', 'primary', 'the brush held over the shirt'),
  kp('bristle', 'tool', 'the bristles under the brush\'s back', ['tomas']),
  kp('bowl', 'skin', 'the hands on the bowl', ['bea']), kp('bowl', 'primary', 'the bowl held over the blouse', ['bea']), kp('bowl', 'apron', 'the bowl held over the apron', ['bea']),
];

head(`KEEPERS (src/art/keeper/palettes.ts: the house ladder, >= ${LUM_MIN * 100}% luminance or >= ${HUE_MIN}deg hue; far side at ${KEEPER_FAR.shade} / ${KEEPER_FAR.desat})`);
for (const id of KEEPER_IDS) {
  const P = KEEPER_PALETTES[id];
  out.push(` ${id}`);
  // (Ka)
  for (const { a, b, where, only } of K_PAIRS) {
    if (only && !only.includes(id)) continue;
    const ca = kcol(id, a), cb = kcol(id, b);
    // (a pair named for this keeper must have both its colours: a slot taken away fails, it does not drop the check)
    if (!ca || !cb) { if (only) { kcount(`(Ka) ${id} ${a}/${b} slot missing`, false); out.push(`  FAIL (Ka) ${(a + '/' + b).padEnd(18)} a colour slot is missing  (${where})`); } continue; }
    const m = ladder(ca, cb);
    kcount(`(Ka) ${id} ${a}/${b}`, m.pass);
    out.push(`${m.pass ? '  ok  ' : '  FAIL'} (Ka) ${(a + '/' + b).padEnd(18)} lum ${pct(m.lum)}  hue ${deg(m.hue)}  ${m.by.padEnd(8)} ${ca} ${cb}  (${where})`);
  }
  // (Kd)
  for (const [slot, hex] of Object.entries(P) as [string, string][]) {
    const t = makeTones(hex), ok = t.sh !== t.base && t.hi !== t.base && t.sh !== t.hi;
    if (!kcount(`(Kd) ${id} ${slot} ramp`, ok)) out.push(`  FAIL (Kd) ${slot} ramp collapses: ${t.sh} ${t.base} ${t.hi}`);
  }
  const skSh = KEEPER_SKIN_SHADOW[id], dSh = relDiff(skSh, P.skin);
  kcount(`(Kd) ${id} skin shadow`, dSh >= LUM_MIN);
  out.push(`${dSh >= LUM_MIN ? '  ok  ' : '  FAIL'} (Kd) skin shadow      ${pct(dSh)} under the skin  ${skSh} on ${P.skin}  (every other slot's ramp: shadow, base and highlight all distinct)`);
  // (Kc) (Ke)
  const far = farPalette(P, KEEPER_FAR.shade, KEEPER_FAR.desat) as Record<string, string>;
  for (const slot of ['skin', 'primary', 'secondary', 'dark'] as const) {
    const f = far[slot], near = P[slot], dn = relDiff(f, near), di = relDiff(f, S.outline), dk = okDiff(f, S.outline);
    const okC = kcount(`(Kc) ${id} far ${slot}`, dn >= LUM_MIN), okE = kcount(`(Ke) ${id} far ${slot} / ink`, di >= LUM_MIN && dk >= OKL_MIN);
    out.push(`${okC && okE ? '  ok  ' : '  FAIL'} (Kc/Ke) far ${slot.padEnd(10)} ${f}  vs near ${pct(dn)}  vs ink ${pct(di)} ${okf(dk)}`);
  }
  // (Ki)
  for (const [floorName, floorHex] of FLOOR_LIST) for (const slot of ['dark', 'secondary'] as const) {
    const d = relDiff(P[slot], floorHex), ok = kcount(`(Ki) ${id} ${slot} / ${floorName} floor`, d >= LUM_MIN);
    out.push(`${ok ? '  ok  ' : '  FAIL'} (Ki) ${(slot === 'dark' ? 'shoes' : 'trousers') + ' / floor'}${' '.repeat(slot === 'dark' ? 5 : 2)} ${pct(d)}  ${P[slot]} on ${floorName} ${floorHex}`);
  }
}
// (Kf)
out.push(' the four tops (RULE_B: as seen, deutan, protan)');
for (let i = 0; i < KEEPER_IDS.length; i++) {
  for (let j = i + 1; j < KEEPER_IDS.length; j++) {
    const a = KEEPER_IDS[i], b = KEEPER_IDS[j], cells: string[] = [];
    let allOk = true;
    for (const [k, f] of [['as seen', (h: string) => h], ['deutan', (h: string) => simulate(h, 'deutan')], ['protan', (h: string) => simulate(h, 'protan')]] as const) {
      const m = ruleB(f(KEEPER_PALETTES[a].primary), f(KEEPER_PALETTES[b].primary));
      if (!kcount(`(Kf) ${a}/${b} tops ${k}`, m.pass)) allOk = false;
      cells.push(`${k} ${m.pass ? m.by : 'FAIL'}`);
    }
    out.push(`${allOk ? '  ok  ' : '  FAIL'} (Kf) ${(a + '/' + b).padEnd(12)} ${cells.join('  ')}  ${KEEPER_PALETTES[a].primary} ${KEEPER_PALETTES[b].primary}`);
  }
}
// (Kg)
out.push(' at work: the night keeper on the dragon of the tuck-in (dusk\'s scale, each stage greyed)');
for (const slot of ['secondary', 'primary'] as const) {
  const c = KEEPER_PALETTES.iris[slot], cells: string[] = [];
  let allOk = true;
  for (const st of STAGES) {
    const m = ladder(c, PAL('dusk', st).scale);
    if (!kcount(`(Kg) iris ${slot} / dusk ${st} scale`, m.pass)) allOk = false;
    cells.push(`${st} ${m.pass ? m.by : 'FAIL'} ${pct(m.lum)}`);
  }
  out.push(`${allOk ? '  ok  ' : '  FAIL'} (Kg) iris ${(slot === 'secondary' ? 'trousers' : 'cardigan').padEnd(9)} ${c} on dusk: ${cells.join('  ')}`);
}

// ---------- (w) backdrops (src/game/surfaces.ts) ----------
/** A body is dark, for gate (w), under this luminance (lightning 0.119, dusk 0.083, slinkwing 0.053 at every stage). */
const W_DARK = 0.15;
let wGates = 0, wFailures = 0;
const wFailed: string[] = [];
function wcount(label: string, ok: boolean): boolean {
  wGates++;
  if (!ok) { wFailures++; wFailed.push(label); }
  return ok;
}
/** How much lighter `a` is than `b` in luminance, (La - Lb) / La: the same as relDiff when `a` is the lighter, below 0 when it is the darker. */
function lighterBy(a: string, b: string): number {
  const la = lumOf(a), lb = lumOf(b);
  return la > 0 ? (la - lb) / la : -1;
}
{
  const dark = DRAGON_ELEMENTS.flatMap((e) => STAGES.map((st) => ({ who: `${e} ${st}`, hex: PAL(e, st).scale }))).filter((b) => lumOf(b.hex) < W_DARK);
  // (the sky, the hills, the clouds, the walls, the stone and the lamps' light must be LIGHTER than every dark body:
  // a colour darker than slinkwing is as far from it by relDiff and still black; only a prop's may lie either way)
  const floorL = Math.max(...dark.map((b) => lumOf(b.hex))) / (1 - LUM_MIN);
  const list: [string, string][] = [];
  // (each phase, then the two stepped mixes into the next: the sky turns night -> dawn -> day -> dusk -> night)
  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const a = PHASE_ORDER[i], b = PHASE_ORDER[(i + 1) % PHASE_ORDER.length];
    for (const k of [0, 1, 2]) {
      const at = k ? `${a}>${b} ${k}/3` : a;
      ['top', 'middle', 'low'].forEach((band, j) => list.push([`sky ${band} ${at}`, stepped(BACKDROPS.sky[a][j], BACKDROPS.sky[b][j], k)]));
      list.push([`hills ${at}`, stepped(BACKDROPS.hills[a], BACKDROPS.hills[b], k)], [`clouds ${at}`, stepped(BACKDROPS.clouds[a], BACKDROPS.clouds[b], k)]);
    }
  }
  list.push(['lift wall', BACKDROPS.liftWall], ['bare wall', BACKDROPS.emptyWall], ['tower stone', BACKDROPS.stone]);
  for (const [k, hex] of Object.entries(WALLS)) list.push([`${k} wall`, hex]);
  list.push(['lamp ring inner', LAMP_RINGS[0]], ['lamp ring outer', LAMP_RINGS[1]], ['hearth ring', HEARTH_RING]);
  const props: [string, string][] = Object.entries(PROPS).map(([k, hex]) => [`prop ${k}`, hex]);
  head(`(w) BACKDROPS  (everything a dragon is seen against: the sky, hills, clouds, walls, stone and lamps' light each >= ${LUM_MIN * 100}% LIGHTER in luminance than every dark body (scale L < ${W_DARK}: ${dark.length} element-stages), so L >= ${floorL.toFixed(3)}, never black; a big prop behind a slot >= ${LUM_MIN * 100}% from them either way; all >= ${OKL_MIN} Oklab L from the ink ${INK})`);
  for (const [what, hex, apart] of [...list.map(([w, h]) => [w, h, false] as const), ...props.map(([w, h]) => [w, h, true] as const)]) {
    let least = Infinity, by = '';
    for (const b of dark) {
      const d = apart ? relDiff(hex, b.hex) : lighterBy(hex, b.hex);
      wcount(`(w) ${what} / ${b.who}`, d >= LUM_MIN);
      if (d < least) { least = d; by = b.who; }
    }
    const ink = okDiff(hex, INK), inkOk = wcount(`(w) ${what} / ink`, ink >= OKL_MIN);
    out.push(`${least >= LUM_MIN && inkOk ? '  ok  ' : '  FAIL'} ${what.padEnd(28)} ${hex}  L ${lumOf(hex).toFixed(3)}  least ${pct(least)} ${apart ? 'apart  ' : 'lighter'} (${by})  ${okf(ink)} from ink`);
  }
}

// ---------- (egg) the Hatchery's eggs (src/game/eggs.ts) ----------
let eGates = 0, eFailures = 0;
const eFailed: string[] = [];
head(`(egg) EGGS  (each element's egg is its baby's scale colour, inked round: >= ${LUM_MIN * 100}% luminance from the nest ${NEST} it lies in, L ${lumOf(NEST).toFixed(3)})`);
for (const e of DRAGON_ELEMENTS) {
  const hex = PAL(e, 'baby').scale, d = relDiff(hex, NEST), ok = d >= LUM_MIN;
  eGates++;
  if (!ok) { eFailures++; eFailed.push(`(egg) ${e}`); }
  out.push(`${ok ? '  ok  ' : '  FAIL'} ${e.padEnd(10)} egg ${hex}  L ${lumOf(hex).toFixed(3)}  ${pct(d)} from the nest (${lumOf(hex) < lumOf(NEST) ? 'darker' : 'lighter'})`);
}
// (egg-lie) what the egg is seen against is the nest's straw, and only that: the pixels just outside its ink ring (the
// ring is a 3 x 3 of ink round every shell pixel: icons.ts drawSprite), at each wobble, all inside the heap's fill a px
// in from its antialiased inked edge, over the floor's band and off its strands. The heap is centred on the nest's x
// (a pixel boundary: the egg's middle column is the pixel to its right), its base nestBase.
{
  const x = 0, y = eggBottom(0), base = nestBase(0), band = floorTop(0) + WALL_H;
  const onStrand = (px: number, py: number) => NEST_STRANDS.some(([dx, dy]) => px >= x + dx && px < x + dx + 4 && py >= base - dy && py < base - dy + 2);
  const inHeap = (px: number, py: number) => py + 0.5 < base && ((px + 0.5 - x) / (NEST_RX - 1)) ** 2 + ((base - py - 0.5) / (NEST_RY - 1)) ** 2 <= 1;
  let bad = '', seen = 0;
  for (const wob of new Set<number>(WOBBLE)) {
    const shell = new Set<string>(), ring = new Set<string>();
    SHELL.forEach((row, r) => [...row].forEach((c, k) => { if (c !== '.') shell.add(`${x + wob - 4 + k},${y - 12 + r}`); }));
    const around = (set: Set<string>) => { const o = new Set<string>(); for (const p of set) { const [px, py] = p.split(',').map(Number); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) o.add(`${px + dx},${py + dy}`); } return o; };
    for (const p of around(shell)) ring.add(p);
    for (const p of around(ring)) {
      if (ring.has(p)) continue;
      seen++;
      const [px, py] = p.split(',').map(Number);
      if (!bad && (!inHeap(px, py) || py >= band || onStrand(px, py))) bad = `at wobble ${wob}, the pixel ${px - x}, ${py - base} from the heap's foot is ${py >= band ? 'the band' : onStrand(px, py) ? 'a strand' : 'off the straw'}`;
    }
  }
  eGates++;
  if (bad) { eFailures++; eFailed.push('(egg-lie) the egg is seen against more than the nest\'s straw'); }
  out.push(`${bad ? '  FAIL' : '  ok  '} egg-lie    every egg lies against the nest's straw alone: the ${seen} pixels round its ink ring over its ${new Set(WOBBLE).size} wobbles, all in the heap (${NEST_RX} x ${NEST_RY} px), over the band, off the strands${bad ? ` -- ${bad}` : ''}`);
}

// ---------- verdict ----------
out.push('');
out.push(failures ? `RESULT: FAIL  ${failures} of ${gates} gates failed: ${failed.join('; ')}` : `RESULT: PASS  ${gates} of ${gates} gates passed`);
out.push(kFailures ? `KEEPERS: FAIL  ${kFailures} of ${kGates} gates failed: ${kFailed.join('; ')}` : `KEEPERS: PASS  ${kGates} of ${kGates} gates passed`);
out.push(wFailures ? `BACKDROPS: FAIL  ${wFailures} of ${wGates} gates failed: ${wFailed.join('; ')}` : `BACKDROPS: PASS  ${wGates} of ${wGates} gates passed`);
out.push(eFailures ? `EGGS: FAIL  ${eFailures} of ${eGates} gates failed: ${eFailed.join('; ')}` : `EGGS: PASS  ${eGates} of ${eGates} gates passed`);
console.log(out.join('\n'));
if (failures || kFailures || wFailures || eFailures) process.exitCode = 1;
