// dragonBuild: element + stage (+ pet seed) -> a complete, resolved build the rig draws from.
//
// It is where the three data sources meet, once, at build time: the stage's proportion set (stages.ts, 2.1), the
// element's modifiers (2.3, half strength on babies) and the element's per-stage feature parameters (element.ts),
// plus the seeded per-pet variant of 2.8. Everything the rig needs per frame is solved here so drawing is pure
// arithmetic: the body height from the hind leg (the paws plant on y = 0), the front-leg nudge that plants the front
// paws exactly, the tail radii, the neck rest angles.
import { makeRng } from '../../lib/engine/rng.ts';
import { rad } from '../../lib/engine/math.ts';
import type { DragonElement, DragonPalette } from './palettes.ts';
import { STAGE_DIMS, stageMod } from './stages.ts';
import type { Stage, StageDims, LegDims, TailRest } from './stages.ts';
import type { ElementSpec, ElementStageParams, MarkingSpec } from './element.ts';
import { ELEMENTS } from './elements/index.ts';
import { buildDragon } from './rig.ts';
import type { DragonRig } from './rig.ts';

/** The stage dimensions after the element's modifiers, plus what build time solves from them. */
export interface DragonDims extends StageDims {
  /** Body centre above the ground, solved from the hind leg (2.1 note). */
  bodyY: number;
  /** Hip back to chest front. */
  bodyLen: number;
  /** Added to the front leg's rest `lower` so the front paws plant on y = 0 too. */
  frontFix: number;
  /** Tail radius at the root and the tip (after the modifier, the tip cap and any absolute override). */
  tailR0: number;
  tailR1: number;
  /** Tail rest shape after the seeded variant. */
  tailRest: TailRest;
  /** Snout length beyond the cranium, px (2 / 6.5 / 9 on fire). */
  snoutLen: number;
  /** Head length, back of the cranium to the snout tip. */
  headLen: number;
}

/** A resolved build: what buildDragon consumes. */
export interface DragonBuild {
  element: DragonElement;
  stage: Stage;
  seed: number;
  spec: ElementSpec;
  /** This stage's feature params, after the seeded variant (2.8). */
  sp: ElementStageParams;
  palette: Readonly<DragonPalette>;
  dims: DragonDims;
  /** Enlarged views only (a 2x care-panel portrait); every stage renders at 1 in play (1.1). */
  scale: number;
  /** Desync (4.1): start phase of looping anims and a +-10 % speed. */
  phase: number;
  speed: number;
}

export interface DragonBuildOpts {
  element: DragonElement;
  stage: Stage;
  /** Per-pet seed, picked at hatching and kept through stage-ups (2.8). Default 1. */
  seed?: number;
  scale?: number;
}

function legOf(l: LegDims, len: number, r: number): LegDims {
  return { ...l, upper: l.upper * len, lower: l.lower * len, r1: l.r1 * r, r2: l.r2 * r };
}

/** Solve a complete build. Allocates: call it when a pet is created or grows, never per frame. */
export function dragonBuild(o: DragonBuildOpts): DragonBuild {
  const spec = ELEMENTS[o.element], stage = o.stage, seed = o.seed ?? 1;
  const S = STAGE_DIMS[stage], M = spec.modifiers;
  const m = (v: number) => stageMod(v, stage);
  const rng = makeRng(seed * 2654435761 + 97);

  // ---- 2.3 modifiers ----
  const gap = S.gap * m(M.bodyLength), depth = m(M.bodyDepth);
  const hipR = S.hipR * depth, chestR = S.chestR * depth;
  const legLen = m(M.legLength), legR = m(M.legR);
  const hind = legOf(S.hind, legLen, legR), front = legOf(S.front, legLen, legR);
  const neckAng = stage === 'baby' ? M.neckAngle / 2 : M.neckAngle;
  const neck = { ...S.neck, len: S.neck.len * m(M.neckLength), rest: S.neck.rest.map((a) => a + neckAng) };

  // Snout: the modifier scales the length BEYOND the cranium (2 / 6.5 / 9), the jaw tip follows the snout tip.
  const H = S.head, sn = H.snout, base0 = spec.stages[stage];
  const beyond0 = sn.x1 + sn.r1 - H.cranR;
  const r1 = M.snoutTaper != null ? sn.r0 * M.snoutTaper : sn.r1;
  const x1 = H.cranR + beyond0 * m(M.snout) - r1;
  const jd = M.jawDepth != null ? m(M.jawDepth) : 1;
  const head = {
    ...H,
    brow: base0.brow ?? H.brow,
    snout: { ...sn, x1, r1 },
    jaw: { ...H.jaw, tx: H.jaw.tx + (x1 - sn.x1), r0: H.jaw.r0 * jd, r1: H.jaw.r1 * jd },
    jawMax: M.jawMax != null ? M.jawMax : H.jawMax,
  };

  // ---- 2.8 seeded variant (inside the 2.7 invariants) ----
  const base = spec.stages[stage];
  const markings: MarkingSpec[] = base.markings.map((mk, i) => {
    if (i === 0) return mk;                          // the first marking is an invariant
    const shift = Math.round(rng.range(-2, 2));
    return mk.at === 'tail' ? { ...mk, dx: (mk.dx || 0) + shift } : { ...mk, dx: (mk.dx || 0) + shift };
  });
  const hornVar = Math.round(rng.range(-1, 1));
  const horns = base.horns ? { ...base.horns, len: Math.max(2, base.horns.len + (stage === 'baby' ? 0 : hornVar)) } : null;
  const bendVar = Math.round(rng.range(-2, 2));
  const tailRest = { first: base.tailRest.first, bend: base.tailRest.bend + (base.tailRest.bend !== 0 ? bendVar : 0) };
  const sp: ElementStageParams = { ...base, markings, horns, tailRest };

  // ---- tail ----
  const tail = { ...S.tail, len: S.tail.len * m(M.tailLength) };
  let tailR0 = S.tail.r0 * m(M.tailR), tailR1 = S.tail.r1 * m(M.tailR);
  if (M.tailTipRMax != null) tailR1 = Math.min(tailR1, M.tailTipRMax);
  if (base.tailR) { tailR0 = base.tailR[0]; tailR1 = base.tailR[1]; }

  // ---- body height from the hind leg (2.1): drop + paw height + hip-joint offset ----
  const hu = rad(hind.restUpper), hl = rad(hind.restUpper + hind.restLower);
  const drop = hind.upper * Math.cos(hu) + hind.lower * Math.cos(hl);
  const bodyY = drop + hind.pawH + hind.y;
  // Front paws: nudge the relative lower angle so the front drop matches (they land within +-1 px unaided).
  const fu = rad(front.restUpper), want = bodyY - front.pawH - front.y;
  const c = Math.max(-1, Math.min(1, (want - front.upper * Math.cos(fu)) / front.lower));
  const absLower = Math.acos(c) * 180 / Math.PI * Math.sign(front.restUpper + front.restLower || 1);
  const frontFix = absLower - (front.restUpper + front.restLower);

  const snoutLen = x1 + r1 - H.cranR;
  const dims: DragonDims = {
    ...S, gap, hipR, chestR,
    sag: S.sag ? { rx: S.sag.rx * m(M.bodyLength), ry: S.sag.ry * depth, cy: S.sag.cy * depth } : null,
    neck, head, hind, front, tail,
    bodyY, bodyLen: gap + hipR + chestR, frontFix, tailR0, tailR1, tailRest,
    snoutLen, headLen: H.cranR * 2 + snoutLen,
  };
  return {
    element: o.element, stage, seed, spec, sp, palette: spec.palette, dims, scale: o.scale ?? 1,
    phase: rng.next(), speed: 1 / (1 + rng.range(-0.1, 0.1)),
  };
}

/** Build a drawable rig for an element and stage in one call (galleries, tools, the care panel). */
export function buildDragonFor(element: DragonElement, stage: Stage, seed = 1, scale = 1): DragonRig {
  return buildDragon(dragonBuild({ element, stage, seed, scale }));
}
