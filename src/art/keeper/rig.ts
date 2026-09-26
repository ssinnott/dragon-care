// A keeper: the engine's humanoid rig (src/lib/art/rig.ts), built from the cast table and drawn in the dragons' scene
// (docs/KEEPERS.md 4). What this adds to the engine's buildRig / drawRig, and nothing more:
//   - buildKeeper: the build (proportions, palette, the part hooks of parts.ts, the tool) and the keeper's own state
//     on the rig -- its spec and palette, the runtime blink, the bowl it holds -- plus the nightcap's chain.
//   - stepKeeper: one 60 Hz step without drawing, so a frozen-time view (the gallery's `t`) can replay a scene and draw
//     one frame. The engine steps a rig's secondary chains inside drawRig only, from a private stepper; this is the
//     same 12 lines on the exported getChain / stepChain / resetChain (the dragons' rig does the same, bible 1.1).
//   - drawKeeper: the ground shadow (the dragons' ink at alpha 0.28), then drawRig with `still`.
// The vendored engine is never edited (bible 1.1): what the keepers need from it that it lacks lives here and in ik.ts.
import { rad } from '../../lib/engine/math.ts';
import { buildRig, computeJoints, drawRig, jointScreen } from '../../lib/art/rig.ts';
import type { DrawRigOpts, FullPose, Rig, RigBuild } from '../../lib/art/rig.ts';
import { getChain, stepChain, resetChain } from '../../lib/art/secondary.ts';
import { makeTones } from '../../lib/art/shading.ts';
import { CAST } from './cast.ts';
import type { CastId, KeeperSpec } from './cast.ts';
import { KEEPER_PALETTES, KEEPER_FAR, KEEPER_SHARED, KEEPER_SKIN_SHADOW } from './palettes.ts';
import type { KeeperPalette } from './palettes.ts';
import { keeperParts, TOOL_BRUSH, HELD_BOWL } from './parts.ts';
import type { HeldBowl } from './parts.ts';

/** The build a keeper is made from: the engine's RigBuild plus the keeper it is. */
export interface KeeperBuild extends RigBuild {
  keeper: Readonly<KeeperSpec>;
}

/** A built keeper: an engine Rig carrying the keeper's own state (parts.ts reads it back off the rig). */
export interface KeeperRig extends Rig {
  build: KeeperBuild;
  spec: Readonly<KeeperSpec>;
  kpal: Readonly<KeeperPalette>;
  /** The runtime blink: 1 while the eyes are shut for a blink (player.ts), 0 otherwise. */
  blink: number;
  /** The bowl in the hands, or null. Its weapon slot entry is TOOL_BOWL while it is held (acts.ts). */
  bowl: HeldBowl | null;
  /** The near hand is open and flat (stroking a dragon: parts.ts drawKeeperHand); set each step by the care agent. */
  open: boolean;
  /** (The miller) the flour sack is hugged in his arms (parts.ts drawKeeperHips draws it under the near arm). */
  sack: boolean;
  /** (The miller) arms folded, both fists tucked out of sight (parts.ts drawKeeperHand); set by the scene. */
  fold: boolean;
}

/** Build a keeper. Allocates: once per keeper. */
export function buildKeeper(id: CastId, scale = 1): KeeperRig {
  const spec = CAST[id], pal = KEEPER_PALETTES[id];
  const build: KeeperBuild = {
    keeper: spec, proportions: spec.proportions, basePalette: { ...pal }, scale,
    farShade: KEEPER_FAR.shade, farDesat: KEEPER_FAR.desat, outline: KEEPER_SHARED.outline,
    parts: keeperParts(spec.sleeves), weapon: spec.tool === 'brush' ? TOOL_BRUSH : null, accessories: [HELD_BOWL],
    // (a keeper's head is the engine's r 9, under drawFace's big-whites size; the face is parts.ts's anyway)
    face: { big: false },
  };
  const k = buildRig(build) as KeeperRig;
  k.spec = spec; k.kpal = pal; k.blink = 0; k.bowl = null; k.open = false; k.sack = spec.tool === 'sack'; k.fold = false;
  // the skin's tone ramp, seeded with its warm hand-set shadow (palettes.ts KEEPER_SKIN_SHADOW): every part drawn in
  // skin (the face, the neck, a forearm, the hands) reads it from the rig's tone cache
  k.tones.set(pal.skin, { ...makeTones(pal.skin, k.ramp), sh: KEEPER_SKIN_SHADOW[id] });
  // the nightcap's cone hangs back off the crown and swings on a chain as she walks (parts.ts CAP_SEGS): a light,
  // damped cloth chain anchored on the head, resting straight back
  if (spec.hat === 'nightcap') getChain(k, 'cap', 3, { joint: 'head', rest: [-1, 0], stiffness: 0.16, damping: 0.72, gain: 3.2, rotGain: 0.5, follow: 0.45, maxAng: 35 });
  return k;
}

/** Per-draw options: the engine's, plus the ground shadow. */
export interface DrawKeeperOpts extends DrawRigOpts {
  /** false = no ground shadow (the floor audit, the silhouette sheet). */
  shadow?: boolean;
  /** Draw every part flat in one colour (the silhouette sheet): the engine's white flash, re-coloured. */
  silhouette?: string | null;
}

/**
 * One 60 Hz step without drawing: solve the joints and the transform as drawRig does, then step the chains from the
 * anchor's screen motion (rig.ts stepChains, which is private). drawKeeper then draws with `still`, so the chains are
 * stepped once per tick whether or not the frame is drawn.
 */
export function stepKeeper(k: KeeperRig, pose: FullPose, o: DrawRigOpts): void {
  const facing = o.facing || 1, sc = (o.scale || 1) * k.scale;
  k.pxScale = sc;
  computeJoints(k, pose);
  const squash = pose.squash, stretch = pose.stretch === 1 && squash !== 1 ? 1 / squash : pose.stretch;
  const t = k.tf;
  t.x = Math.round(o.x); t.y = Math.round(o.y); t.fs = facing * sc * squash; t.ss = sc * stretch;
  t.rx = k.snap ? Math.round(pose.root.x * sc) / sc : pose.root.x; t.ry = k.snap ? Math.round(pose.root.y * sc) / sc : pose.root.y;
  t.c = Math.cos(rad(pose.root.rot)); t.s = Math.sin(rad(pose.root.rot));
  k.facing = facing;
  for (const name in k.chains) {
    const c = k.chains[name];
    const ang = c.joint === 'torso' ? k.joints.torsoAngle : k.joints.headAngle;
    jointScreen(k, c.joint, c.pt);
    const inv = 1 / (Math.abs(t.fs) || 1);
    if (c.init) {
      const dx = (c.pt.x - c.lastX) * facing * inv, dy = (c.pt.y - c.lastY) * inv;
      if (Math.abs(dx) > c.teleport || Math.abs(dy) > c.teleport) resetChain(c);
      else stepChain(c, dx, dy, ang - c.lastAng + pose.root.rot - c.lastRoot);
    }
    c.init = true; c.lastX = c.pt.x; c.lastY = c.pt.y; c.lastAng = ang; c.lastRoot = pose.root.rot;
  }
  k.tick++; k.chainFrame = k.tick;
}

/**
 * Draw a keeper at screen (o.x, o.y), the ground point between the feet: the ground shadow, then the rig. The pose is
 * the player's (full); a keeper is stepped separately (stepKeeper), so the rig is always drawn `still`.
 */
export function drawKeeper(ctx: CanvasRenderingContext2D, k: KeeperRig, pose: FullPose, o: DrawKeeperOpts): void {
  const sc = (o.scale || 1) * k.scale, facing = o.facing || 1;
  if (o.shadow !== false && !o.silhouette) {
    // the ground shadow: (torso width + 6) x 3, under the feet whatever the body does (a kneel lowers the body, not the floor)
    const w = k.p.torsoW + 6, rx = pose.root.x * facing * sc;
    ctx.fillStyle = KEEPER_SHARED.groundShadow;
    ctx.beginPath(); ctx.ellipse(Math.round(o.x + rx), Math.round(o.y), (w / 2) * sc, 1.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (o.silhouette) {
    // the flat silhouette (bible 5.1 #1): every fill and the ink in one colour. drawRig sets rig.override only on its
    // own flash / tint path and leaves it alone on the plain one, so the hooks and the engine's cel helpers (through
    // rig.col) paint everything in it
    k.override = o.silhouette;
    drawRig(ctx, k, pose, { x: o.x, y: o.y, facing: o.facing, scale: o.scale, still: true });
    k.override = null;
    return;
  }
  drawRig(ctx, k, pose, { ...o, still: true });
}

/** Where a joint of a keeper is on screen after its last step or draw (engine jointScreen, typed to the keeper). */
export function keeperJoint(k: KeeperRig, name: 'handN' | 'handF' | 'head' | 'torso' | 'ankleN' | 'ankleF' | 'kneeN' | 'kneeF' | 'neck', out: { x: number; y: number }): { x: number; y: number } {
  return jointScreen(k, name, out);
}
