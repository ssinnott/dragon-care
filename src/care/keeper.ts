// A keeper in a scene (docs/KEEPERS.md 6): the rig, its player and where it stands, stepped once per 60 Hz tick.
// The gallery's keeper sheets and the care acts both use this; the yard (yard.ts) moves keepers around with it.
import { solveArm, shoulderOf } from '../art/keeper/ik.ts';
import type { Walker } from './path.ts';
import type { LimbAngles } from '../art/keeper/ik.ts';
import { buildKeeper, stepKeeper, drawKeeper } from '../art/keeper/rig.ts';
import { markFull, computeJoints } from '../lib/art/rig.ts';
import { makePose, copyPose } from '../lib/art/poses.ts';
import type { KeeperRig, DrawKeeperOpts } from '../art/keeper/rig.ts';
import type { FullPose } from '../lib/art/rig.ts';
import { KeeperPlayer } from '../art/keeper/player.ts';
import { keeperAnims } from '../art/keeper/anims.ts';
import type { HandT } from '../art/keeper/anims.ts';
import type { KeeperId } from '../art/keeper/cast.ts';

export interface KeeperAgent {
  id: KeeperId;
  rig: KeeperRig;
  player: KeeperPlayer;
  /** Screen position of the floor point between the feet, facing (1 right, -1 left) and draw scale. */
  x: number;
  y: number;
  facing: number;
  scale: number;
  /**
   * Where the near hand reaches this tick, in the keeper's ground space (from its floor point, facing +x, y up
   * negative), or null: after the player's pose, the near arm is re-solved toward it (a pet follows the dragon's head,
   * which its own pet anim moves). `reachW` blends it in (0..1) so a hand eases onto its mark and off it.
   */
  reach: HandT | null;
  reachW: number;
  /** Walking on the spot: the anim's root motion does not carry it along the floor (acts.ts walkTo, into the scene). */
  pinX: boolean;
}

/** Make a keeper standing at (x, y) and playing `anim` (its whole anim table built for its proportions and tempo). */
export function makeKeeper(id: KeeperId, anim: string, x: number, y: number, o: { facing?: number; scale?: number; seed?: number; blinks?: boolean } = {}): KeeperAgent {
  const rig = buildKeeper(id), player = new KeeperPlayer(keeperAnims(rig.spec), o.seed ?? 1);
  player.blinks = o.blinks !== false;
  player.play(anim, { restart: true });
  const k: KeeperAgent = { id, rig, player, x, y, facing: o.facing ?? 1, scale: o.scale ?? 1, reach: null, reachW: 0, pinX: false };
  settle(k);
  return k;
}

const LA: LimbAngles = { upper: 0, lower: 0 };

/**
 * Put the near hand on `reach` (ground space) in `pose`: the arm solved there (ik.ts solveArm) and blended over the
 * pose's own arm by `w`. At full weight, a small search against the pixel snap: the engine snaps every joint to the
 * pixel grid, which walked the hand up to 2.4 px off its mark, so the arm is solved again for the mark moved back by
 * the error and for half-pixel nudges round that, the joints placed each time (computeJoints), and the solve that
 * lands nearest kept. Used by a tick (settle) and by the planner's dry runs alike.
 */
function reachArm(k: KeeperAgent, pose: FullPose, reach: HandT, w: number): void {
  const p = k.rig.p, t = pose.torso, u0 = pose.armR.upper, l0 = pose.armR.lower;
  solveArm(p, true, t.rot, t.x, t.y, reach.x - pose.root.x, reach.y - pose.root.y, LA);
  pose.armR.upper = u0 + (LA.upper - u0) * w; pose.armR.lower = l0 + (LA.lower - l0) * w;
  if (w < 1) return;
  let best = handError(k, pose, reach), bu = pose.armR.upper, bl = pose.armR.lower;
  if (best <= 0.5) return;
  const cx = reach.x - ERR.x, cy = reach.y - ERR.y;
  for (const [ox, oy] of NUDGE) {
    solveArm(p, true, t.rot, t.x, t.y, cx + ox - pose.root.x, cy + oy - pose.root.y, LA);
    pose.armR.upper = LA.upper; pose.armR.lower = LA.lower;
    const e = handError(k, pose, reach);
    if (e < best) { best = e; bu = LA.upper; bl = LA.lower; if (e <= 0.5) break; }
  }
  pose.armR.upper = bu; pose.armR.lower = bl;
}
/** The snap search's targets round the corrected mark, ground px. */
const NUDGE: readonly (readonly [number, number])[] = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]];

const ERR = { x: 0, y: 0 };
/** How far the near hand's joint lands from `reach` in `pose`, px of ground space (ERR: the vector), as placed. */
function handError(k: KeeperAgent, pose: FullPose, reach: HandT): number {
  const sc = k.scale * k.rig.scale, snap = k.rig.snap;
  k.rig.pxScale = sc;
  const h = computeJoints(k.rig, pose).handN;
  const rx = snap ? Math.round(pose.root.x * sc) / sc : pose.root.x, ry = snap ? Math.round(pose.root.y * sc) / sc : pose.root.y;
  ERR.x = h.x + rx - reach.x; ERR.y = h.y + ry - reach.y;
  return Math.hypot(ERR.x, ERR.y);
}

/** Write the frame's pose onto the rig: the reach overlay, the blink, the joints and the chains (no motion). */
function settle(k: KeeperAgent): void {
  const pose = k.player.pose;
  if (k.reach && k.reachW > 0) reachArm(k, pose, k.reach, Math.min(1, k.reachW));
  k.rig.blink = k.player.lid;
  stepKeeper(k.rig, pose, { x: k.x, y: k.y, facing: k.facing, scale: k.scale });
}

/** Advance one 60 Hz step: the anim, the root motion along facing (a walk carries the keeper), the rig. */
export function stepKeeperAgent(k: KeeperAgent): void {
  k.player.tick();
  const mv = k.player.move;
  if (mv && !k.pinX) k.x += k.facing * mv * k.scale;
  settle(k);
}

/** Draw a keeper (already stepped this tick). */
export function drawKeeperAgent(ctx: CanvasRenderingContext2D, k: KeeperAgent, o: Partial<DrawKeeperOpts> = {}): void {
  drawKeeper(ctx, k.rig, k.player.pose, { x: k.x, y: k.y, facing: k.facing, scale: k.scale, ...o });
}

/** A keeper's drawn extent over its walks, measured once per keeper, walk and bowl (walkerOf). */
const EXTENTS = new Map<string, { hw: number; h: number }>();
/** The walks a keeper's extent is measured over. */
const WALKS = ['walk', 'carry', 'tiptoe'] as const;

/**
 * A keeper as its walk sees it (path.ts), on screen px: half its width and its height over its feet, as DRAWN over
 * its walk cycles (every frame of walk, carry and tiptoe, drawn off screen and the covered pixels' box read back: the
 * arms' swing, the nightcap's cone, a bowl or the brush in hand; once per keeper, and again with a bowl in its hands),
 * and half its feet's span. An estimate from the proportions let a swinging hand reach 4 px into an eye.
 */
export function walkerOf(k: KeeperAgent): Walker {
  const p = k.rig.p, sc = k.scale * k.rig.scale, key = `${k.id}:${k.rig.bowl ? 'bowl' : '-'}:${sc}`;
  let e = EXTENTS.get(key);
  if (!e) {
    if (!dryCanvas) { dryCanvas = document.createElement('canvas'); dryCanvas.width = 400; dryCanvas.height = 300; dryCtx = dryCanvas.getContext('2d', { willReadFrequently: true }); }
    const g = dryCtx!, X = 200, Y = 260;
    let hw = 0, h = 0;
    for (const anim of WALKS) {
      const a = k.player.anims[anim];
      if (!a) continue;
      // (every 2nd frame: the walks are sampled every frame, and a swing peaks over several)
      for (let i = 0; i < a.frames.length; i += 2) {
        copyPose(a.frames[i].pose ?? null, DRY_POSE, true);
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(X - 100, Y - 140, 200, 150);
        drawKeeper(g, k.rig, DRY_POSE, { x: X, y: Y, facing: 1, scale: k.scale, shadow: false });
        const px = g.getImageData(X - 100, Y - 140, 200, 150).data;
        for (let y = 0; y < 150; y++) for (let x = 0; x < 200; x++) if (px[(y * 200 + x) * 4 + 3] >= 128) { hw = Math.max(hw, Math.abs(x - 100 + 0.5)); h = Math.max(h, 140 - y); }
      }
    }
    // (the nightcap's cone swings on its chain: a few px more than the frames it was measured in)
    e = { hw: hw + 2, h: h + 2 };
    EXTENTS.set(key, e);
  }
  return { hw: e.hw, fw: (p.hipX + p.footL * 0.6) * sc, h: e.h };
}

/** A screen point in a keeper's ground space (from its floor point, facing +x, y up negative, game px). */
export function toGround(k: KeeperAgent, sx: number, sy: number): HandT {
  return { x: ((sx - k.x) * k.facing) / k.scale, y: (sy - k.y) / k.scale };
}

/** A screen-space box: the pixels from (x0, y0) up to, not including, (x1, y1). */
export interface Box { x0: number; y0: number; x1: number; y1: number }

let dryCanvas: HTMLCanvasElement | null = null, dryCtx: CanvasRenderingContext2D | null = null;
const DRY_POSE = markFull(makePose());

/** What a dry run found: the pixels drawn over the box, and how far the reaching hand landed from its mark (px). */
export interface DryRun { cover: number; miss: number }
const DRY: DryRun = { cover: 0, miss: 0 };

/**
 * A DRY RUN of a keeper's pose: frame `frame` of its anim `anim`, standing at (x, y) facing `facing`, its near hand
 * reaching for `reach` (ground space, as KeeperAgent.reach) if given, blended over the anim's own arm by `reachW`.
 * `miss`: how far the hand's joint lands from the mark, the arm solved as a tick solves it (settle) and the joints
 * placed as the engine places them (computeJoints, snapped to the pixel grid), so it is the miss the care audit
 * measures. `cover`, with a `box`: the keeper drawn alone on a scratch canvas, the pixels it covers (alpha >= 50 %)
 * inside the box; `quick`: only the near fist, from its joints (fistOver), without drawing: a cheap first test (a
 * pixel it finds is drawn; one it misses may still be). The care acts use them to choose where a keeper stands before
 * it walks over: its hand reaches its mark, and its body, its arms and its hat stay off the dragon's eye (K7). The rig
 * is re-solved by the keeper's next step, so nothing of a dry run stays on it. The result is reused: read it before
 * the next call.
 */
export function dryRun(k: KeeperAgent, anim: string, frame: number, x: number, y: number, facing: number, reach: HandT | null, box: Box | null, reachW = 1, quick = false): DryRun {
  const a = k.player.anims[anim], fr = a?.frames[Math.min(Math.max(0, frame), (a?.frames.length ?? 1) - 1)];
  copyPose(fr?.pose ?? null, DRY_POSE, true);
  if (fr?.face != null) DRY_POSE.face = typeof fr.face === 'number' ? fr.face : 0;
  DRY.cover = 0; DRY.miss = 0;
  // (as a tick: the solved arm blended over the anim's own by reachW, a hand easing onto its mark or off it)
  if (reach) reachArm(k, DRY_POSE, reach, reachW);
  // (the joints placed: the miss, and the fist the quick test reads)
  if (reach) DRY.miss = handError(k, DRY_POSE, reach) * k.scale;
  else if (quick) { k.rig.pxScale = k.scale * k.rig.scale; computeJoints(k.rig, DRY_POSE); }
  if (!box) return DRY;
  if (quick) { DRY.cover = fistOver(k, x, y, facing, box); return DRY; }
  const w = Math.max(1, box.x1 - box.x0), h = Math.max(1, box.y1 - box.y0);
  if (!dryCanvas) { dryCanvas = document.createElement('canvas'); dryCanvas.width = 400; dryCanvas.height = 300; dryCtx = dryCanvas.getContext('2d', { willReadFrequently: true }); }
  const g = dryCtx!;
  // the box's corner lands at (100, 100) on the scratch canvas, the keeper where it stands relative to it; drawn
  // clipped to the box (the rasteriser skips the rest of the figure: the planner makes a few thousand of these)
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(100, 100, w, h);
  g.save(); g.beginPath(); g.rect(100, 100, w, h); g.clip();
  drawKeeper(g, k.rig, DRY_POSE, { x: x - box.x0 + 100, y: y - box.y0 + 100, facing, scale: k.scale, shadow: false });
  g.restore();
  const px = g.getImageData(100, 100, w, h).data;
  for (let i = 3; i < px.length; i += 4) if (px[i] >= 128) DRY.cover++;
  return DRY;
}

/**
 * The pixels of `box` the near fist covers, from the rig's joints as the last computeJoints left them (the keeper
 * standing at (x, y) facing `facing`): the engine's fist (rigParts.ts drawFist) is a block rounded at 0.8 r, from
 * -0.6 r to +1.6 r along the forearm and -r to +r across it, with the thumb's ball (0.55 r) on one edge, drawn round
 * the hand joint turned to the hand's angle; a pixel whose centre falls inside it or its 1 px ink counts.
 */
function fistOver(k: KeeperAgent, x: number, y: number, facing: number, box: Box): number {
  const J = k.rig.joints, r = k.rig.p.handR, sc = k.scale * k.rig.scale, snap = k.rig.snap, R = Math.round;
  const rx = snap ? R(DRY_POSE.root.x * sc) / sc : DRY_POSE.root.x, ry = snap ? R(DRY_POSE.root.y * sc) / sc : DRY_POSE.root.y;
  const hx = R(x) + (J.handN.x + rx) * facing * sc, hy = R(y) + (J.handN.y + ry) * sc;
  // (hand space is root space turned by 90 - hand deg: its +x runs (sin, cos) of the hand angle, its -y, the thumb's
  // side, (cos, -sin); the sprite's facing mirrors x)
  const a = (J.armN.hand * Math.PI) / 180, ux = Math.sin(a) * facing, uy = Math.cos(a), wx = Math.cos(a) * facing, wy = -Math.sin(a);
  // the block (drawFist's rounded x0, w, y0, h and corner), the thumb's ball, in screen px; the ink 1 px round both
  const x0 = R(-r * 0.6), bw = R(r * 2.2), y0 = R(-r), bh = R(r * 2), cr = R(r * 0.8) * sc;
  const a0 = x0 * sc, a1 = (x0 + bw) * sc, s0 = -(y0 + bh) * sc, s1 = -y0 * sc;
  const ta = (x0 + R(r * 0.9)) * sc, ts = -y0 * sc, tr = R(r * 0.55) * sc + 1;
  let n = 0;
  for (let py = box.y0; py < box.y1; py++) for (let px = box.x0; px < box.x1; px++) {
    const dx = px + 0.5 - hx, dy = py + 0.5 - hy, al = dx * ux + dy * uy, sd = dx * wx + dy * wy;
    const ca = Math.min(Math.max(al, a0 + cr), a1 - cr), cs = Math.min(Math.max(sd, s0 + cr), s1 - cr);
    if (Math.hypot(al - ca, sd - cs) <= cr + 1 || Math.hypot(al - ta, sd - ts) <= tr) n++;
  }
  return n;
}

/** A dry run's cover alone (dryRun with a box). */
export function coverage(k: KeeperAgent, anim: string, frame: number, x: number, y: number, facing: number, reach: HandT | null, box: Box): number {
  return dryRun(k, anim, frame, x, y, facing, reach, box).cover;
}

/**
 * Where the near shoulder is in frame `frame` of a keeper anim, in ground space (from the floor point, facing +x, y up
 * negative, unscaled): the joint the near arm is solved from (ik.ts shoulderOf, moved by the frame's root offset).
 */
export function shoulderAt(k: KeeperAgent, anim: string, frame: number, out: { x: number; y: number }): { x: number; y: number } {
  const a = k.player.anims[anim], fr = a?.frames[Math.min(Math.max(0, frame), (a?.frames.length ?? 1) - 1)];
  copyPose(fr?.pose ?? null, DRY_POSE, true);
  shoulderOf(k.rig.p, true, DRY_POSE.torso.rot, DRY_POSE.torso.x, DRY_POSE.torso.y, out);
  out.x += DRY_POSE.root.x; out.y += DRY_POSE.root.y;
  return out;
}

/** The frame an anim shows `t` frames after it starts (a loop wraps; a one-shot holds its last frame). */
export function frameAt(frames: readonly { dur?: number }[], t: number, loop: boolean): number {
  let total = 0;
  for (const f of frames) total += f.dur || 1;
  let u = loop && total > 0 ? ((t % total) + total) % total : t;
  for (let i = 0; i < frames.length; i++) { u -= frames[i].dur || 1; if (u < 0) return i; }
  return frames.length - 1;
}
