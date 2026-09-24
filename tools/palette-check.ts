// Palette ladder check for the dragon palettes (src/art/dragon/palettes.ts), measured, never eyeballed.
//
//   node tools/palette-check.ts          full report, exit code 1 if any gate fails
//
// It reads only the palette data and the engine's own colour maths (toneOf / makeTones from shading.ts,
// farPalette from palettes.ts): no canvas, no rig, no browser. That makes it the cheapest check in the art
// pipeline, in the same spirit as the "palette tier" docs/ART_GENERATOR.md describes, so run it before drawing
// anything with a new hex. Its report is pasted into docs/ART_BIBLE.md; re-paste it when a value changes.
//
// GATES (a failure sets exit code 1):
//   (a) adjacency : within each dragon, every pair of colours that touch on the sprite separates by
//                   >= 25 % relative luminance OR >= 40 deg hue (the house ladder). Hue only counts when both
//                   colours are chromatic (HSV S >= 0.20 and V >= 0.25): the hue angle of a near-grey or a
//                   near-black is noise, not colour. Pairs include the cel tones a pigment edge crosses: a marking
//                   runs through the body's shadow and highlight bands, and the belly line runs through the shadow.
//   (b) elements  : the six SCALE colours (the body, about half of every sprite) are pairwise distinguishable.
//                   See RULE_B below for the rule and why.
//   (c) far side  : c1 the engine's farPalette(p, 0.62, 0.25) far scale and far membrane keep >= 25 % luminance
//                   from the near scale; c2 the rig's own far LEG shading (DRAGON_FAR.legs) keeps >= 25 % AND
//                   >= OKL_MIN Oklab lightness from the near leg's base AND its shadow band; c3 the rig's far wing /
//                   head shading keeps the far membrane and any far paired horn >= 25 % from the near scale.
//   (d) ramps     : makeTones keeps shadow != base != highlight (and deep != shadow) after rounding, for every slot;
//                   a hand-set shadow (palettes.ts DRAGON_SHADOW, rock's) keeps >= 25 % luminance under its base.
//   (e) ink floor : far leg scale, far membrane and far paired horns stay >= 25 % luminance AND >= OKL_MIN Oklab
//                   lightness from the outline, so far parts do not sink into the ink.
//   (f) colour-blind: the same 15 scale pairs still pass RULE_B under simulated deuteranopia and protanopia
//                   (about 1 player in 16 sees one of those two ways), because the habitat puts several dragons side
//                   by side and a player must tell their pets apart by more than the silhouette alone. The blush on
//                   each cheek is checked the same way (with the ladder), since it carries the happy face.
//   (h) mood states: every pair of colours a mood swaps between passes the ladder, so the change can be seen.
//   (i) floor     : every scale, every belly and the outer colour of every effect that lands on the floor keeps
//                   >= 25 % luminance from the reference habitat floor. Hue cannot help: the floor's S is < 0.20.
// REPORTED, NOT GATED:
//   (g) any scale pair that passes (b) on hue alone (it would merge in greyscale); glow colours close to another
//       element's glow (they must then differ by effect shape).
import { hexToRgb, farPalette } from '../src/lib/art/palettes.ts';
import { toneOf, RAMP } from '../src/lib/art/shading.ts';
import { DRAGON_ELEMENTS, DRAGON_PALETTES, DRAGON_SHARED, DRAGON_FAR, DRAGON_SLOTS, DRAGON_SHADOW, blushOf, moodTones, dragonTones } from '../src/art/dragon/palettes.ts';
import type { DragonElement, DragonPalette, DragonSlot } from '../src/art/dragon/palettes.ts';

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
/** The engine's far-side defaults (rig.ts FAR_SHADE / FAR_DESAT), which gate (c) is written against. */
const ENGINE_FAR = { shade: 0.62, desat: 0.25 };
/**
 * Reference habitat floor for gate (i): a pale, low-saturation straw floor. The six bodies span luminance
 * 0.05..0.49 on purpose (see gate (b)), so only a light floor can sit >= 25 % from all of them, and every belly
 * must then sit <= 0.50 or >= 0.90 in luminance.
 */
const FLOOR_REF = '#e0d6b8';
/** Elements whose head carries a PAIRED horn, so a far horn is drawn against the near head (bible section 3). */
const PAIRED_HORNS: readonly DragonElement[] = ['fire', 'spike', 'lightning'];
/**
 * Elements whose legs are narrower than the engine's FLAT_R (5) at every stage, so no near leg ever gets a shadow band
 * and c2 compares the far leg against the near leg's base only. Slinkwing's leg radius is x0.75 (bible 2.3): its
 * shadow tone sits only ~12 Oklab L above the ink, too narrow a window for a far leg to clear both by OKL_MIN.
 */
const FLAT_LEGS: readonly DragonElement[] = ['slinkwing'];

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
interface BodyMeasure { lum: number; hue: number; dS: number; pass: boolean; hueOnly: boolean; by: string; }
/** RULE_B between two body colours (gates b and f). */
function ruleB(a: string, b: string): BodyMeasure {
  const ha = hsvOf(a), hb = hsvOf(b);
  const lum = relDiff(a, b), hue = hueDelta(a, b), dS = Math.abs(ha.s - hb.s);
  const b1 = ha.s >= B_SAT && hb.s >= B_SAT && hue >= HUE_MIN;
  const b2 = lum >= LUM_MIN;
  const b3 = (ha.s < B_SAT || hb.s < B_SAT) && dS >= B_DSAT && lum >= B_LUM_WITH_DSAT;
  const by = [b1 ? 'B1' : '', b2 ? 'B2' : '', b3 ? 'B3' : ''].filter(Boolean).join('+');
  return { lum, hue, dS, pass: b1 || b2 || b3, hueOnly: b1 && !b2 && !b3, by };
}
const pct = (v: number): string => `${Math.round(v * 100)}%`.padStart(4);
const deg = (v: number | null): string => (v == null ? '  n/a' : `${Math.round(v)}deg`.padStart(5));
const okf = (v: number): string => `okL ${v.toFixed(1)}`.padStart(8);

// ---------- report plumbing ----------
const out: string[] = [];
let gates = 0, failures = 0;
const failed: string[] = [];
function gate(label: string, ok: boolean, line: string): void {
  gates++;
  if (!ok) { failures++; failed.push(label); }
  out.push(`${ok ? '  ok  ' : '  FAIL'} ${line}`);
}
function head(title: string): void { out.push('', title); }

// ---------- colour references: a slot, a slot's cel tone, or a shared / derived colour ----------
type Tone = 'hi' | 'sh' | 'deep';
/** What a pair names: `scale`, `scale.sh`, `ink` (the outline), `blush`, or a mood tone (`banked`, `dimSpot`). */
type Ref = DragonSlot | `${DragonSlot}.${Tone}` | 'ink' | 'blush' | 'banked' | 'dimSpot';
const P = (e: DragonElement): Readonly<DragonPalette> => DRAGON_PALETTES[e];
const S = DRAGON_SHARED;
function colour(e: DragonElement, ref: Ref): string {
  if (ref === 'ink') return S.outline;
  if (ref === 'blush') return blushOf(e);
  if (ref === 'banked' || ref === 'dimSpot') return moodTones(P(e))[ref];
  const [slot, tone] = ref.split('.') as [DragonSlot, Tone | undefined];
  return tone ? dragonTones(e, slot, RAMP)[tone] : P(e)[slot];
}

// ---------- adjacency: which colours touch on the sprite ----------
interface Pair { a: Ref; b: Ref; why: string; }
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
};
/** The outer colour of every effect that lands on the floor (gate i), by element. */
const FLOOR_FX: Readonly<Record<DragonElement, readonly { what: string; ref: Ref }[]>> = {
  fire: [{ what: 'breath puff outer ring', ref: 'scale' }],
  spike: [{ what: 'sap streak / sparkle edge', ref: 'scale' }],
  rock: [{ what: 'dust puff (opaque)', ref: 'scale' }, { what: 'adult roar puff ring', ref: 'scale.sh' }, { what: 'pebble', ref: 'marking' }],
  lightning: [{ what: 'spark ring', ref: 'scale' }],
  water: [{ what: 'bubble / drip ring', ref: 'membrane' }],
  slinkwing: [{ what: 'sound arc', ref: 'membrane' }, { what: 'sound arc edge', ref: 'scale' }],
};

out.push('DRAGON PALETTE CHECK  (tools/palette-check.ts)');
out.push(`ladder: >= ${LUM_MIN * 100}% rel. luminance OR >= ${HUE_MIN}deg hue (hue counts only when S >= ${CHROMA_S} and V >= ${CHROMA_V})`);

// (a) -----------------------------------------------------------------------------------------------------
head('(a) ADJACENT COLOURS WITHIN EACH DRAGON');
function pairLine(e: DragonElement, a: Ref, b: Ref): void {
  const ca = colour(e, a), cb = colour(e, b), m = ladder(ca, cb);
  gate(`(a) ${e} ${a}/${b}`, m.pass, `${(a + '/' + b).padEnd(19)} ${ca} ${cb}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  ${m.by}`);
}
for (const e of DRAGON_ELEMENTS) {
  out.push(` ${e}`);
  for (const pr of [...CORE_PAIRS, ...EXTRA_PAIRS[e]]) pairLine(e, pr.a, pr.b);
  // the face: iris against the 2x2 catchlight (adult catchlights sit on the iris) and against the pupil,
  // and the blush, which sits on the cheek scale
  for (const [name, a, b] of [['eye/catchlight', P(e).eye, S.catchlight], ['eye/pupil', P(e).eye, S.pupil], ['blush/scale', blushOf(e), P(e).scale]] as const) {
    const m = ladder(a, b);
    gate(`(a) ${e} ${name}`, m.pass, `${name.padEnd(19)} ${a} ${b}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  ${m.by}`);
  }
}
out.push(' shared');
for (const [name, a, b] of [['mouth/tongue', S.mouth, S.tongue], ['mouth/fang', S.mouth, S.catchlight]] as const) {
  const m = ladder(a, b);
  gate(`(a) shared ${name}`, m.pass, `${name.padEnd(19)} ${a} ${b}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  ${m.by}`);
}

// (b) -----------------------------------------------------------------------------------------------------
head('(b) SCALE COLOURS ACROSS ELEMENTS  (B1 hue: both S>=0.30 and >=40deg | B2 value: >=25% | B3 chroma: dS>=0.30 and >=12%)');
const hueOnly: [DragonElement, DragonElement][] = [];
for (let i = 0; i < DRAGON_ELEMENTS.length; i++) {
  for (let j = i + 1; j < DRAGON_ELEMENTS.length; j++) {
    const ea = DRAGON_ELEMENTS[i], eb = DRAGON_ELEMENTS[j], a = P(ea).scale, b = P(eb).scale, m = ruleB(a, b);
    if (m.hueOnly) hueOnly.push([ea, eb]);
    gate(`(b) ${ea}/${eb}`, m.pass, `${(ea + '/' + eb).padEnd(22)} ${a} ${b}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  dS ${m.dS.toFixed(2)}  ${m.by}`);
  }
}
out.push(' scale S/V: ' + DRAGON_ELEMENTS.map((e) => { const c = hsvOf(P(e).scale); return `${e} ${c.s.toFixed(2)}/${c.v.toFixed(2)}`; }).join('  '));

// (c) -----------------------------------------------------------------------------------------------------
head(`(c) FAR SIDE vs NEAR SCALE  (>= ${LUM_MIN * 100}% luminance; hue does not count, far parts share the near hue)`);
/** One far-side comparison: far[slot] from farPalette(p, shade, desat) against a near-side tone of the scale. */
function farGate(e: DragonElement, tag: string, shade: number, desat: number, slot: DragonSlot, near: 'base' | 'sh', ok = false): string {
  const pal = P(e), far = farPalette(pal, shade, desat)[slot];
  const ref = near === 'base' ? pal.scale : dragonTones(e, 'scale', RAMP).sh;
  const d = relDiff(far, ref), o = okDiff(far, ref), pass = d >= LUM_MIN && (!ok || o >= OKL_MIN);
  gates++;
  if (!pass) { failures++; failed.push(`(c) ${e} ${tag} far ${slot} vs near scale.${near}`); }
  return `${slot} ${far}${near === 'sh' ? ' vs ' + ref : ''} ${pct(d)}${ok ? ' ' + okf(o) : ''}${pass ? '' : ' FAIL'}`;
}
const L = DRAGON_FAR.legs, W = DRAGON_FAR.wingAndHead;
out.push(` c1  engine default farPalette(p, ${ENGINE_FAR.shade}, ${ENGINE_FAR.desat}): far scale and far membrane vs near scale`);
for (const e of DRAGON_ELEMENTS) {
  out.push(`        ${e.padEnd(12)} ${farGate(e, 'c1', ENGINE_FAR.shade, ENGINE_FAR.desat, 'scale', 'base')}   ${farGate(e, 'c1', ENGINE_FAR.shade, ENGINE_FAR.desat, 'membrane', 'base')}`);
}
out.push(` c2  rig far LEGS farPalette(p, ${L.shade}, ${L.desat}): far leg vs near leg base, and vs near leg SHADOW band (scale.sh); >= ${LUM_MIN * 100}% and >= okL ${OKL_MIN}`);
for (const e of DRAGON_ELEMENTS) {
  const engineSh = relDiff(farPalette(P(e), ENGINE_FAR.shade, ENGINE_FAR.desat).scale, dragonTones(e, 'scale', RAMP).sh);
  const base = farGate(e, 'c2', L.shade, L.desat, 'scale', 'base', true);
  const sh = FLAT_LEGS.includes(e) ? '(legs flat at every stage: no shadow band to cross)'
    : `${farGate(e, 'c2', L.shade, L.desat, 'scale', 'sh', true)}   (engine default: ${pct(engineSh)}${engineSh < LUM_MIN ? ', would fail' : ''})`;
  out.push(`        ${e.padEnd(12)} ${base}   ${sh}`);
}
out.push(` c3  rig far WING + HEAD features farPalette(p, ${W.shade}, ${W.desat}): far membrane (wing, ear-fan, fin-ear) and far paired horn vs near scale`);
for (const e of DRAGON_ELEMENTS) {
  const cells = [farGate(e, 'c3', W.shade, W.desat, 'membrane', 'base')];
  if (PAIRED_HORNS.includes(e)) cells.push(farGate(e, 'c3', W.shade, W.desat, 'horn', 'base'));
  out.push(`        ${e.padEnd(12)} ${cells.join('   ')}${PAIRED_HORNS.includes(e) ? '' : '   (no paired horns)'}`);
}

// (d) -----------------------------------------------------------------------------------------------------
head('(d) CEL RAMPS  (engine makeTones, default RAMP: hi 1.22 / sh 0.66 / deep 0.51)');
let weakest = { step: 9, where: '' };
for (const e of DRAGON_ELEMENTS) {
  const pal = P(e), bad: string[] = [];
  for (const s of DRAGON_SLOTS) {
    const t = dragonTones(e, s, RAMP);
    const collapsed = t.sh === t.base || t.hi === t.base || t.sh === t.hi || t.deep === t.sh;
    gates++;
    if (collapsed) { failures++; failed.push(`(d) ${e} ${s}`); bad.push(s); }
    if (s !== 'glow' && s !== 'eye' && s !== 'dark') {
      const step = relDiff(t.hi, t.base);
      if (step < weakest.step) weakest = { step, where: `${e}.${s} ${t.base} -> hi ${t.hi}` };
    }
  }
  out.push(`${bad.length ? '  FAIL' : '  ok  '} ${e.padEnd(12)} 8 ramps distinct${bad.length ? '; collapsed: ' + bad.join(', ') : ''}`);
}
out.push(`        weakest highlight step on a banded slot: ${pct(weakest.step)} (${weakest.where})`);
for (const e of DRAGON_ELEMENTS) {
  const o = DRAGON_SHADOW[e];
  if (!o) continue;
  for (const s of DRAGON_SLOTS) {
    const sh = o[s];
    if (!sh) continue;
    const d = relDiff(sh, P(e)[s]), ok = d >= LUM_MIN;
    gates++;
    if (!ok) { failures++; failed.push(`(d) ${e} ${s} hand-set shadow`); }
    out.push(`${ok ? '  ok  ' : '  FAIL'} ${e.padEnd(12)} hand-set ${s}.sh ${sh} (engine ${toneOf(P(e)[s], RAMP.sh)}) ${pct(d)} under ${P(e)[s]}`);
  }
}

// (e) -----------------------------------------------------------------------------------------------------
head(`(e) INK FLOOR  (far leg scale, far wing membrane and far paired horn vs outline ${S.outline}: >= ${LUM_MIN * 100}% and >= okL ${OKL_MIN})`);
for (const e of DRAGON_ELEMENTS) {
  const legs = farPalette(P(e), L.shade, L.desat), wing = farPalette(P(e), W.shade, W.desat);
  const parts: [string, string][] = [['far leg scale', legs.scale], ['far membrane', wing.membrane]];
  if (PAIRED_HORNS.includes(e)) parts.push(['far horn', wing.horn]);
  const cells: string[] = [];
  let allOk = true;
  for (const [name, hex] of parts) {
    const d = relDiff(hex, S.outline), o = okDiff(hex, S.outline), ok = d >= LUM_MIN && o >= OKL_MIN;
    gates++;
    if (!ok) { failures++; failed.push(`(e) ${e} ${name}`); allOk = false; }
    cells.push(`${name} ${hex} ${pct(d)} ${okf(o)}${ok ? '' : ' FAIL'}`);
  }
  out.push(`${allOk ? '  ok  ' : '  FAIL'} ${e.padEnd(12)} ${cells.join('   ')}`);
}

// (f) -----------------------------------------------------------------------------------------------------
head('(f) COLOUR-BLIND SAFETY  (simulated deuteranopia / protanopia, Vienot 1999: 15 scale pairs by RULE_B, blush/scale by the ladder)');
for (const k of ['deutan', 'protan'] as const) {
  out.push(` ${k}`);
  for (let i = 0; i < DRAGON_ELEMENTS.length; i++) {
    for (let j = i + 1; j < DRAGON_ELEMENTS.length; j++) {
      const ea = DRAGON_ELEMENTS[i], eb = DRAGON_ELEMENTS[j];
      const a = simulate(P(ea).scale, k), b = simulate(P(eb).scale, k), m = ruleB(a, b);
      gate(`(f) ${k} ${ea}/${eb}`, m.pass, `${(ea + '/' + eb).padEnd(22)} ${a} ${b}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  S ${hsvOf(a).s.toFixed(2)}/${hsvOf(b).s.toFixed(2)}  ${m.by}`);
    }
  }
  for (const e of DRAGON_ELEMENTS) {
    const a = simulate(blushOf(e), k), b = simulate(P(e).scale, k), m = ladder(a, b);
    gate(`(f) ${k} ${e} blush/scale`, m.pass, `${(e + ' blush/scale').padEnd(22)} ${a} ${b}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  ${m.by}`);
  }
}

// (h) -----------------------------------------------------------------------------------------------------
head('(h) MOOD STATES  (colours a mood swaps between; the ladder, so the change is visible)');
for (const e of DRAGON_ELEMENTS) {
  const pairs = MOOD_PAIRS[e];
  if (!pairs) continue;
  out.push(` ${e}`);
  for (const pr of pairs) {
    const ca = colour(e, pr.a), cb = colour(e, pr.b), m = ladder(ca, cb);
    gate(`(h) ${e} ${pr.a}/${pr.b}`, m.pass, `${(pr.a + '/' + pr.b).padEnd(19)} ${ca} ${cb}  lum ${pct(m.lum)}  hue ${deg(m.hue)}  ${m.by}  (${pr.why})`);
  }
}

// (i) -----------------------------------------------------------------------------------------------------
head(`(i) HABITAT FLOOR ${FLOOR_REF}  (L ${lumOf(FLOOR_REF).toFixed(2)}, S ${hsvOf(FLOOR_REF).s.toFixed(2)}: hue never counts, >= ${LUM_MIN * 100}% luminance)`);
for (const e of DRAGON_ELEMENTS) {
  const cells: string[] = [];
  let allOk = true;
  const items: { what: string; ref: Ref }[] = [{ what: 'scale', ref: 'scale' }, { what: 'belly', ref: 'belly' }, ...FLOOR_FX[e]];
  for (const it of items) {
    const hex = colour(e, it.ref), d = relDiff(hex, FLOOR_REF), ok = d >= LUM_MIN;
    gates++;
    if (!ok) { failures++; failed.push(`(i) ${e} ${it.what}`); allOk = false; }
    cells.push(`${it.what} ${pct(d)}${ok ? '' : ' FAIL'}`);
  }
  out.push(`${allOk ? '  ok  ' : '  FAIL'} ${e.padEnd(12)} ${cells.join('  ')}`);
}

// (g) -----------------------------------------------------------------------------------------------------
head('(g) REPORTED, NOT GATED');
out.push(` scale pairs passing (b) on hue only, so they would merge in greyscale: ${hueOnly.length ? hueOnly.map((p) => p.join('/')).join(', ') : 'none'}`);
out.push(' glow pairs across elements within 40deg hue AND 25% luminance (must differ by effect SHAPE):');
let glowClose = 0;
for (let i = 0; i < DRAGON_ELEMENTS.length; i++) {
  for (let j = i + 1; j < DRAGON_ELEMENTS.length; j++) {
    const ea = DRAGON_ELEMENTS[i], eb = DRAGON_ELEMENTS[j], m = ladder(P(ea).glow, P(eb).glow);
    if (!m.pass) { glowClose++; out.push(`   ${(ea + '/' + eb).padEnd(22)} ${P(ea).glow} ${P(eb).glow}  lum ${pct(m.lum)}  hue ${deg(m.hue)}`); }
  }
}
if (!glowClose) out.push('   none');

// ---------- verdict ----------
out.push('');
out.push(failures ? `RESULT: FAIL  ${failures} of ${gates} gates failed: ${failed.join('; ')}` : `RESULT: PASS  ${gates} of ${gates} gates passed`);
console.log(out.join('\n'));
if (failures) process.exitCode = 1;
