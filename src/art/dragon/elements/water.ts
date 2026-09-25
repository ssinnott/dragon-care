// WATER: "Ripple", the tide dragon (docs/ART_BIBLE.md 3.6). Zone: the tail end, low and level. Cue: a vertical
// crescent fluke at the end of the longest, flattest body in the cast. The fluke, the fin-ears and the pearl spots
// are its mood gauge together (D7): at mood -1 (and asleep) the fluke and fin-ears droop and the spots dim; at +1
// the fluke's lobes spread, the fin-ears flare and the spots glow.
//
// What this file draws, by anchor (element.ts):
//   tailTip   the fluke (baby: a tadpole paddle; the elder's grown, with its pearls), the tail running into it with no
//             ink across the joint;
//   farHead   the fin-ear, drawn BEFORE the neck and skull so only what breaks their contour shows;
//   nearHead  the wind-up's cheek puff and the hungry lip-lick;
//   backRow   the dorsal fin (its own renderer, so its base stays clear of the tail it sits on);
//   breath    Bubble Jet (the baby's snout bubble; the elder's ends in one bubble ring), and the sleeping nostril
//             bubble;
//   ambient   the drip, the shake's droplets and the happy flourish's bubbles (top pass).
// Every bubble, drop and dot is a whole-pixel construction in face space (rig.ts enterFace): an anti-aliased 2-4 px
// ring dissolved into a grey smudge at game scale.
import { DRAGON_PALETTES, DRAGON_SHARED } from '../palettes.ts';
import { TAIL_REST, FIDGET_TIMING } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { cranToRootPt, enterFace, enterFaceFromCranium, enterFaceFromLocal, localToRootPt, rootToScreen } from '../rig.ts';
import { pixelStroke, dorsalLineY } from '../features.ts';
import { skullBands } from '../parts.ts';
import { ACT, DFACE } from '../pose.ts';
import type { DragonPose } from '../pose.ts';
import { bake, ELDER_FINALE } from '../anims.ts';
import type { DragonAnim } from '../anim.ts';
import { hash01, liveSpawns } from '../fx.ts';
import type { TopItem } from '../fx.ts';
import { celPath, outlinePath, tones } from '../../../lib/art/shading.ts';
import { pathTaperedCapsule } from '../../../lib/art/shapes.ts';

const PAL = DRAGON_PALETTES.water;
const INK = DRAGON_SHARED.outline, PEARL = DRAGON_SHARED.catchlight, TONGUE = DRAGON_SHARED.tongue;
const D2R = Math.PI / 180;

/** The mood gauge's state for the fluke and fin-ears: 1 flared, 0 at rest, -1 drooped (sad, dry, asleep). */
function gauge(pose: DragonPose, info: DragonInfo): number {
  if (info.asleep) return -1;
  // the Bubble Jet's wind-up flares the fins and they stay up through the stream (3.6); the baby while it blows
  if (pose.act === ACT.breath && (pose.cue < 0 || pose.fx > 0)) return 1;
  return info.mood >= 0.5 ? 1 : info.mood <= -0.3 ? -1 : 0;
}

// ---------- the fluke ----------

/**
 * Fluke height x depth (3.6 table), rays, the px each lobe spreads when flared, the round baby paddle, the notch's
 * depth (px in from the lobe tips: >= 3, so both lobes read), the crescent's two edges (the quadratic control points
 * of the convex leading edge and the concave trailing edge, as fractions of the depth and the half-height), where
 * the rays start (`ray0`: px forward of the tail's tip; they start r0 + 1 out from its axis), the adult's lobe `dot`
 * and the elder's lobe `pearl` (its centre, px in from the lobe tip along the fluke and across it, at the REST height,
 * so it stays put when the lobes flare). The adult carries 2 rays, one per lobe, like the young: a third down the
 * middle filled the notch, and a lobe 4-5 px thick holds one 2 px ray; its adult-only extra is the lobe glow dots.
 *   The ELDER's crescent grows to 18 x 9, whole (3.6), its notch 4 deep in proportion, and keeps the young's sprout,
 * a ray down each lobe (2.6: the adult's signature or grown), its dots grown into its elder-only extra, the PEARLS:
 * 3 x 3 in `horn`, drawn at every mood, where the adult's dot sits (2 px in from the tip at their nearest), each at
 * the end of its lobe's ray with 1 px of membrane between them and all round the pearl. That needs a lobe about 7 px
 * thick across the pearl, a square on a diagonal lobe: the lobes are FULLER than the adult's, most of all in their
 * outer half -- the trailing edge leaves the tip straight back along the fluke's depth (control (1.0 D, 0.2 h/2)) and
 * only turns into the notch near the middle, the leading edge runs out level to the tip (control (0.15 D, 1.0 h/2)) --
 * a broad old whale's fluke. On the adult's thinner lobes the pearl sat in the lobe's inner half, clear of the ray
 * only by dropping it: a crescent with two pale squares, plainer than the adult's (the elder review). Its rays start
 * at the tail's tip, not 1 px behind it (ray0 0), so each is a 4 px dash before its pearl and the drooped lower lobe,
 * swung in under the tail, still has room for one.
 */
const FLUKE: Readonly<Record<Stage, {
  h: number; d: number; rays: number; round: boolean; flare: number; notch: number;
  lead: readonly [number, number]; trail: readonly [number, number]; ray0: number; dot: boolean; pearl: readonly [number, number] | null;
}>> = {
  baby: { h: 10, d: 6, rays: 0, round: true, flare: 1, notch: 0, lead: [0, 0], trail: [0, 0], ray0: -1, dot: false, pearl: null },
  young: { h: 11, d: 6, rays: 2, round: false, flare: 1, notch: 3.5, lead: [0.28, 0.88], trail: [0.52, 0.36], ray0: -1, dot: false, pearl: null },
  adult: { h: 16, d: 8, rays: 2, round: false, flare: 1.5, notch: 3.5, lead: [0.28, 0.88], trail: [0.52, 0.36], ray0: -1, dot: true, pearl: null },
  elder: { h: 18, d: 9, rays: 2, round: false, flare: 1.5, notch: 4, lead: [0.15, 1.0], trail: [1.0, 0.2], ray0: 0, dot: false, pearl: [3.5, 4] },
};
/** Droop at the low end of the gauge, deg (3.6: 15; the fluke keeps its full size). */
const DROOP = 15;
/** How far forward of the tail's tip the fluke's edges leave its contour: the paddle wraps further along the tail. */
const JOIN: Readonly<Record<Stage, number>> = { baby: 6, young: 2.5, adult: 2.5, elder: 2.5 };

let RC = 1, RS = 0;
/** A fluke point (tail-tip space) turned by the droop about the tail tip, into FP. */
function fp(x: number, y: number): { x: number; y: number } { FP.x = x * RC - y * RS; FP.y = x * RS + y * RC; return FP; }
const FP = { x: 0, y: 0 };

/**
 * The fluke outline, tail-tip space (the tail continues toward -x, the body is toward +x), drooped by (RC, RS) about
 * the tip. It starts and ends ON the tail's contour `jx` px forward of the tip (radius rJ there), so the tail runs
 * into the fin: the closing edge lies inside the tail and the clip in tailTip keeps its ink off it.
 *   baby : a tadpole paddle, one rounded leaf in one flat tone, its top and bottom edges swelling off the tail from
 *          the joint (a disc hung on the tip read as a lollipop) to its widest two-thirds of the way out, its back
 *          end round;
 *   young / adult / elder: a vertical crescent -- convex leading edges out to the lobe tips, concave trailing edges
 *          into a central notch `notch` px deep.
 */
function flukePath(ctx: CanvasRenderingContext2D, F: Readonly<typeof FLUKE.adult>, H: number, D: number, jx: number, rJ: number): void {
  const round = F.round, notch = F.notch, L0 = F.lead[0], L1 = F.lead[1], T0 = F.trail[0], T1 = F.trail[1];
  ctx.beginPath();
  ctx.moveTo(jx, -rJ);
  let p;
  if (round) {
    // ONE rounded leaf, widest two-thirds of the way out from the joint, its back end round with no notch: notched
    // (and with the tail run on through it) it split into two round dark lobes, a dog-bone or a club end
    const xw = jx - (jx + D) * 0.67;
    p = fp(jx - (jx - xw) * 0.6, -H); const ax = p.x, ay = p.y; p = fp(xw, -H); ctx.quadraticCurveTo(ax, ay, p.x, p.y);
    p = fp(-D + 0.5, -H); const bx = p.x, by = p.y; p = fp(-D, -H * 0.35); const cx = p.x, cy = p.y; p = fp(-D, 0); ctx.bezierCurveTo(bx, by, cx, cy, p.x, p.y);
    p = fp(-D, H * 0.35); const dx = p.x, dy = p.y; p = fp(-D + 0.5, H); const ex = p.x, ey = p.y; p = fp(xw, H); ctx.bezierCurveTo(dx, dy, ex, ey, p.x, p.y);
    p = fp(jx - (jx - xw) * 0.6, H); ctx.quadraticCurveTo(p.x, p.y, jx, rJ);
  } else {
    p = fp(-D * L0, -H * L1); const ax = p.x, ay = p.y; p = fp(-D, -H); ctx.quadraticCurveTo(ax, ay, p.x, p.y);
    p = fp(-D * T0, -H * T1); const bx = p.x, by = p.y; p = fp(-D + notch, 0); ctx.quadraticCurveTo(bx, by, p.x, p.y);
    p = fp(-D * T0, H * T1); const cx = p.x, cy = p.y; p = fp(-D, H); ctx.quadraticCurveTo(cx, cy, p.x, p.y);
    p = fp(-D * L0, H * L1); ctx.quadraticCurveTo(p.x, p.y, jx, rJ);
  }
  ctx.closePath();
}

/**
 * The tipBox of each stage (element.ts): the fluke's box in tail-tip space at its largest (flared) and at its droop,
 * ink included, so the rig lifts the tail's end before a lobe could reach the floor (1.1, 5.1 #14).
 */
function tipBox(st: Stage): readonly [number, number, number, number] {
  const F = FLUKE[st], H = F.h / 2 + F.flare, D = F.d;
  let x0 = 0, y0 = 0, x1 = JOIN[st], y1 = 0;
  for (const deg of [0, DROOP]) {
    const c = Math.cos(deg * D2R), s = -Math.sin(deg * D2R);
    for (const [x, y] of [[-D, -H], [-D, H], [-D * 0.6, -H], [-D * 0.6, H]]) {
      const X = x * c - y * s, Y = x * s + y * c;
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
  }
  return [Math.floor(x0 - 1), Math.floor(y0 - 1), x1, Math.ceil(y1 + 1)];
}

/**
 * Bible 3.6 "The cue: the fluke tail". Tail-tip space. Membrane, 2 tones (no highlight); young, adult and elder carry
 * a 2 px `horn` ray down each lobe, the adult a 2 x 2 `glow` dot in from each lobe tip and the elder, in its place, a
 * 3 x 3 `horn` PEARL (its elder-only extra: "the old tide dragon's pearls", at every mood: FLUKE), all whole pixels in
 * face space (features.ts pixelStroke: a 2 px stroke in the rotated tail-tip space anti-aliased into mush). The tail
 * RUNS INTO the fin: the fin is clipped off the tail's interior only, so its fill covers the tail's end cap and ink,
 * and its own ink leaves the tail's contour where the lobes do -- one silhouette, no line across the joint.
 * Gauge: drooped 15 deg (sad, dry, asleep), the lobes spread `flare` px each (happy).
 */
const tailTip: ElementDraw = (ctx, rig, pose, info) => {
  const st = info.stage, F = FLUKE[st], J = rig.j, tn = J.tailN, g = gauge(pose, info);
  const H = F.h / 2 + (g > 0 ? F.flare : 0), D = F.d, droop = g < 0 ? DROOP : 0;
  // (the tail runs on toward -x, so the lobes swing DOWN, +y, under a counter-clockwise turn)
  RC = Math.cos(droop * D2R); RS = -Math.sin(droop * D2R);
  // the tail's last segment in tail-tip space: the node before the tip, turned back out of the tip angle
  const a = -info.ang * D2R, dx = J.tailX[tn - 1] - J.tailX[tn], dy = J.tailY[tn - 1] - J.tailY[tn];
  const px = dx * Math.cos(a) - dy * Math.sin(a), py = dx * Math.sin(a) + dy * Math.cos(a);
  const r0 = J.tailR[tn], r1 = J.tailR[tn - 1], jx = JOIN[st];
  const rJ = r0 + (r1 - r0) * Math.min(1, jx / (Math.hypot(px, py) || 1));
  ctx.save();
  ctx.beginPath(); ctx.rect(-60, -60, 120, 120);
  pathTaperedCapsule(ctx, 0, 0, px, py, Math.max(0.5, r0 - 0.5), Math.max(0.5, r1 - 0.5), true);
  ctx.clip('evenodd');
  flukePath(ctx, F, H, D, jx, rJ);
  // (the baby's paddle one flat membrane tone: a shadow band across its lower half made a second dark lobe)
  celPath(ctx, rig, info.pal.membrane, -D / 2, 0, Math.max(F.h, F.d) / 2, F.round ? 0 : 0.4, 0);
  if (!rig.override && F.rays) {
    ctx.save(); flukePath(ctx, F, H, D, jx, rJ); ctx.clip();
    const ox = J.tailX[tn], oy = J.tailY[tn], pr = F.pearl;
    for (let k = -1; k <= 1; k += 2) {
      // one ray down the middle of each lobe, radiating from the tail's end just clear of its contour (the clip off
      // the tail is anti-aliased; a ray starting 2.5 px out was a 2 x 3 stub by the lobe's back edge) toward the lobe
      // tip, on a 10 deg bucket (bucketRay). The adult's ray and its glow dot (in from the lobe tip, where it stays
      // whole when the lobes flare) share one face-space origin, and the ray stops where 1 px of membrane still
      // shows before the dot: placed and rounded apart, they touched as one white-cyan streak. The elder's ray runs
      // at its pearl the same way, the pearl placed from the ray's origin with that origin's own rounding (facePt):
      // from the root-space difference alone it strayed a pixel onto the lobe's ink
      rayEnds(F, D, H, r0, k, ox, oy, info.ang);
      enterFaceFromLocal(ctx, rig, ox, oy, info.ang, R0.x, R0.y);
      ctx.fillStyle = info.pal.horn;
      if (pr) {
        facePt(rig, R0, R1, DOT); DOT.x = Math.round(DOT.x - 0.5); DOT.y = Math.round(DOT.y - 0.5);
        bucketRay(ctx, DOT.x + 0.5, DOT.y + 0.5, DOT, 3);
        pearl(ctx, rig, info.pal.horn, DOT.x, DOT.y);
      } else {
        if (F.dot) { DOT.x = Math.round(R1.x - R0.x); DOT.y = Math.round(R1.y - R0.y); }
        bucketRay(ctx, R1.x - R0.x, R1.y - R0.y, F.dot ? DOT : null, 2);
      }
      ctx.restore();
    }
    ctx.restore();
    // the adult's glow dots, stamped whole AFTER the fluke's clip: it is anti-aliased, and inside it the dot lost the
    // corner nearest the lobe's edge (3 px and a blend, the elder review). Set in from the tip at the rest height, a
    // dot never reaches past the edge's ink
    if (F.dot) {
      for (let k = -1; k <= 1; k += 2) {
        rayEnds(F, D, H, r0, k, ox, oy, info.ang);
        enterFaceFromLocal(ctx, rig, ox, oy, info.ang, R0.x, R0.y);
        ctx.fillStyle = info.pal.glow; ctx.fillRect(Math.round(R1.x - R0.x) - 1, Math.round(R1.y - R0.y) - 1, 2, 2);
        ctx.restore();
      }
    }
  }
  ctx.restore();
};
const R0 = { x: 0, y: 0 }, R1 = { x: 0, y: 0 }, S0 = { x: 0, y: 0 }, S1 = { x: 0, y: 0 };

/**
 * Lobe k's ray (-1 upper, +1 lower), root space: its origin into R0 (`ray0` px forward of the tail's tip, r0 + 1 out
 * from its axis) and what it runs at into R1 -- the elder's pearl, the adult's dot, or (the young) 2 px in from the
 * lobe tip at the gauge's height. Turned by the droop with the fluke (fp).
 */
function rayEnds(F: Readonly<typeof FLUKE.adult>, D: number, H: number, r0: number, k: number, ox: number, oy: number, ang: number): void {
  let p = fp(F.ray0, k * (r0 + 1)); localToRootPt(ox, oy, ang, p.x, p.y, R0);
  const pr = F.pearl;
  p = pr ? fp(-D + pr[0], k * (F.h / 2 - pr[1])) : F.dot ? fp(-D + 3.5, k * (F.h / 2 - 2.5)) : fp(-D + 2, k * (H - 2.5));
  localToRootPt(ox, oy, ang, p.x, p.y, R1);
}

/**
 * Root point B in the face space entered at root point A (faceTransform: A's screen point rounded to a whole device
 * pixel, unrotated, mirrored with the facing), into `out`, its sub-pixel part kept: a mark placed from A's origin by
 * the root-space difference alone lands up to a pixel off (the rounding of A, the squash, the root's turn).
 */
function facePt(rig: DragonRig, A: { x: number; y: number }, B: { x: number; y: number }, out: { x: number; y: number }): void {
  const t = rig.tf, k = rig.pxScale || 1;
  rootToScreen(rig, A.x, A.y, S0); rootToScreen(rig, B.x, B.y, S1);
  out.x = (S1.x - Math.round(S0.x)) * Math.sign(t.fs || 1) / k; out.y = (S1.y - Math.round(S0.y)) * (t.ss < 0 ? -1 : 1) / k;
}

// ---------- the fin-ears ----------

/**
 * Fin-ear length (out past the skull's contour) x height, ray, and `k0`, the least height of its axis above the
 * cranium centre (px, across the ear): the ear rides at least that high even where no neck is in its way (3.6
 * table). Smooth on the young (two 2 px rays would fill it), one ray on the adult with 2 px of membrane either side.
 */
const FIN: Readonly<Record<Stage, { l: number; h: number; ray: boolean; k0: number }>> = {
  baby: { l: 4.5, h: 4, ray: false, k0: 4 },
  young: { l: 5, h: 4, ray: false, k0: 3 },
  adult: { l: 7, h: 6, ray: true, k0: 3 },
  elder: { l: 7, h: 6, ray: true, k0: 3 },
};
/** The ear's root runs this far inside the skull's contour, px: hidden behind it (drawn before the skull). */
const EAR_SINK = 3;
/**
 * World limits of the ear's direction, deg below straight back: never more than 20 up (lying back along a neck that
 * rises behind a head lowered to the bowl or the floor) and never more than 40 down (a begging head on an upright
 * neck hung the drooped ear straight down its back, an earbud).
 */
const EAR_UP = -20, EAR_DOWN = 40;
/**
 * The ear's angle off the neck line by gauge, deg above it: flared, at rest, drooped (it lies on the neck, folded).
 * Riding on the neck, an ear drooped 25 deg below its line (the old table) dived into the neck and vanished; standing,
 * EAR_DOWN takes the droop further.
 */
const EAR_OFF = { flare: 10, rest: 4, droop: -8 };

/**
 * The ear this frame, cranium space: root on the skull's contour (x, y), direction `a` (rad BELOW straight back),
 * length `l` and height `h`. Quiet-zone rule (3.0): it points back along the neck line (rig.j.neckRef; a baby's
 * hidden neck: 10 deg below straight back) and even flared rises <= 10 deg above it, clamped in the world
 * (EAR_UP / EAR_DOWN). It rides ON the neck: its axis sits half its height above the highest point of the neck and
 * the chest within its reach, so its lower edge lies along their top contour and the whole fan shows past it, from
 * the notch where the head's contour meets the neck's (behind the cheek standing, the upper back of the head with
 * the head on the floor). Drooped it folds back a quarter of its length, flared it fans 2 px longer.
 */
function earFrame(rig: DragonRig, pose: DragonPose, info: DragonInfo): { x: number; y: number; a: number; l: number; h: number } {
  const F = FIN[rig.stage], R = rig.dims.head.cranR, g = gauge(pose, info), J = rig.j;
  const ref = rig.stage === 'baby' ? 10 : J.neckRef;
  const off = g > 0 ? EAR_OFF.flare : g < 0 ? EAR_OFF.droop : EAR_OFF.rest;
  const l = F.l + (g > 0 ? 2 : g < 0 ? -Math.round(F.l * 0.25) : 0), h = F.h;
  // (a neck rising steeply behind a head on the floor: the ear lifts, 4 deg at a time, until it rides clear of it)
  let w = Math.min(Math.max(ref - off - J.headAng, EAR_UP), EAR_DOWN), k = 0, a = 0;
  for (;;) {
    a = (w + J.headAng) * D2R;
    k = rig.dims.neck.hidden ? 0 : neckTop(rig, a, R + l) + h / 2 + 0.5;
    if (k <= R - 0.5 || w <= EAR_UP) break;
    w = Math.max(EAR_UP, w - 4);
  }
  k = Math.min(Math.max(k, F.k0), R - 0.5);
  const c = Math.cos(a), s = Math.sin(a), t = Math.sqrt(R * R - k * k);
  EF.x = -k * s - t * c; EF.y = -k * c + t * s; EF.a = a; EF.l = l; EF.h = h;
  return EF;
}

/**
 * The highest top edge of the neck and the chest ball, measured ACROSS a line through the cranium centre pointing `a`
 * rad below straight back (cranium space; along its upper normal), among the parts that lie up to `reach` px along
 * it: what an ear pointing that way has to ride over. -1e9 when nothing is in reach.
 */
function neckTop(rig: DragonRig, a: number, reach: number): number {
  const J = rig.j, c = Math.cos(a), s = Math.sin(a), hc = Math.cos(J.headAng * D2R), hs = Math.sin(J.headAng * D2R);
  let v = -1e9;
  for (let i = 0; i <= J.neckN * 3 + 1; i++) {
    let x, y, r;
    if (i > J.neckN * 3) { x = J.chest.x; y = J.chest.y; r = rig.dims.chestR; }
    else {
      const k = Math.min(J.neckN - 1, Math.floor(i / 3)), u = i / 3 - k;
      x = J.neckX[k] + (J.neckX[k + 1] - J.neckX[k]) * u; y = J.neckY[k] + (J.neckY[k + 1] - J.neckY[k]) * u;
      r = J.neckR[k] + (J.neckR[k + 1] - J.neckR[k]) * u;
    }
    const dx = x - J.cran.x, dy = y - J.cran.y, px = dx * hc + dy * hs, py = -dx * hs + dy * hc;
    const along = -c * px + s * py;
    if (along >= 0 && along <= reach) v = Math.max(v, -s * px - c * py + r);
  }
  return v;
}
const EF = { x: 0, y: 0, a: 0, l: 0, h: 0 };

/**
 * Bible 3.6 "Fin-ears". Cranium space, drawn at farHead (step 3), BEFORE the neck and the skull: one membrane fan,
 * inked, its root hidden behind the back of the skull, so only what breaks the head and neck contour shows. Drawn
 * over them (the old near ear, plus a far one 3 px behind), it lay along the neck inside the silhouette asleep,
 * eating and begging, a dark box with a white bar beside the eye: headphones, a second closed eye. One ear shows
 * (a far one was a sliver cap over it: 1.5), in the NEAR palette. The adult's 2 px `horn` ray runs down the fan's
 * middle as a whole-pixel run in face space (bucketRay), and shows only when the ear flares (happy, the breath): a
 * fin spreads its ray, a limp one folds it, and a 2 x 4 white bar in a small dark fan at rest read as a headphone's
 * highlight or a cat's inner ear.
 */
function finEar(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const F = FIN[info.stage], E = earFrame(rig, pose, info), pal = info.near;
  ctx.save();
  ctx.translate(E.x, E.y); ctx.rotate(-E.a);
  earPath(ctx, E.l, E.h);
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(pal.membrane); ctx.fill();
  if (F.ray && gauge(pose, info) > 0 && !rig.override) {
    ctx.clip();
    ctx.rotate(E.a); ctx.translate(-E.x, -E.y);
    // down the fan's middle, from inside the skull's contour out to the webbed edge's middle point
    const c = Math.cos(E.a), s = Math.sin(E.a);
    cranToRootPt(rig, E.x + 1 * c, E.y - 1 * s, R0);
    cranToRootPt(rig, E.x - (E.l + 0.5) * c, E.y + (E.l + 0.5) * s, R1);
    enterFaceFromCranium(ctx, rig, R0.x, R0.y);
    ctx.fillStyle = pal.horn;
    bucketRay(ctx, R1.x - R0.x, R1.y - R0.y, null, 2);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * The fin-ear's outline in its own space (the root at the origin on the skull's contour, the ear pointing toward
 * -x): a small fan `l` px long and `h` px across, narrow where it starts EAR_SINK px inside the skull, spreading back
 * to a webbed trailing edge -- two shallow scallops between its corners and a middle point where the ray ends. A
 * round lobe read as an ear-cup.
 */
function earPath(ctx: CanvasRenderingContext2D, l: number, h: number): void {
  const h0 = Math.min(1.5, h * 0.3);
  ctx.beginPath();
  ctx.moveTo(EAR_SINK, -h0);
  ctx.quadraticCurveTo(-l * 0.45, -h * 0.5, -l, -h * 0.5);
  ctx.quadraticCurveTo(-l + 1.8, -h * 0.25, -l - 0.3, h * 0.05);
  ctx.quadraticCurveTo(-l + 2.2, h * 0.3, -l + 1.2, h * 0.5);
  ctx.quadraticCurveTo(-l * 0.4, h * 0.35, EAR_SINK, h0);
  ctx.closePath();
}

/**
 * A 2 px ray in FACE space from the origin along the root-space vector (dx, dy), its angle snapped to a 10 deg bucket
 * and its length to whole pixels along its major axis (fluke and fin-ear rays): re-rounded from fresh endpoints every
 * frame, a ray crawled between a 3 x 3 block and a 2 x 4 diagonal as the tail swayed (5.1 #12). One bucket, one
 * bitmap. With a `dot` (the face-space pixel of an m x m mark: the adult fluke's 2 x 2 glow dot, covering dot - 1 ..
 * dot, or the elder's 3 x 3 pearl, dot - 1 .. dot + 1) the ray stops where 1 px of membrane shows between them on
 * one axis at least. The adult's ray keeps 2 steps whatever; the elder's, with no room for 2 steps clear of its
 * pearl, is not drawn (a lone 2 x 2 by the tail's end is a speck).
 */
function bucketRay(ctx: CanvasRenderingContext2D, dx: number, dy: number, dot: { x: number; y: number } | null, m: number): void {
  const a = Math.round(Math.atan2(dy, dx) / (10 * D2R)) * 10 * D2R, c = Math.cos(a), s = Math.sin(a);
  // unit steps along the major axis
  const M = Math.max(Math.abs(c), Math.abs(s)), ux = c / M, uy = s / M;
  let n = Math.round(Math.max(Math.abs(dx), Math.abs(dy)));
  if (dot) {
    const min = m === 3 ? 0 : 1;
    while (n > min && !clear1(Math.round(ux * n), dot.x, m) && !clear1(Math.round(uy * n), dot.y, m)) n--;
    if (m === 3 && n < 1) return;
  }
  pixelStroke(ctx, 0, 0, Math.round(ux * n), Math.round(uy * n));
}
/** A step's 2 x 2 at s (s - 1 .. s) and an m x m mark at p (p - 1 .. p + m - 2) have a whole pixel between them. */
function clear1(s: number, p: number, m: number): boolean { return s <= p - 3 || s >= p + m + 1; }
const DOT = { x: 0, y: 0 };

/**
 * The elder's PEARL (3.6, its elder-only extra), face space, its centre pixel at (x, y): a 3 x 3 bead in `horn` (the
 * pearl-white of its rays and spots, 90 % from the membrane it sits on), its 4 corners in the horn's shadow tone so it
 * reads ROUND at 1x -- a bead, not one more square spot (with the shade as a bottom-right L it read as a die or a
 * rivet: the elder review). Whole pixels, flat: two tones on 9 px, never a band.
 */
function pearl(ctx: CanvasRenderingContext2D, rig: DragonRig, hex: string, x: number, y: number): void {
  ctx.fillStyle = rig.col(hex); ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = rig.col(tones(rig, hex).sh);
  ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1);
}

/** Cranium space: where the ear's tip is this frame (the drip's source), into `out`. */
function earTip(rig: DragonRig, pose: DragonPose, info: DragonInfo, out: { x: number; y: number }): void {
  const E = earFrame(rig, pose, info), L = E.l - 1;
  out.x = E.x - Math.cos(E.a) * L; out.y = E.y + Math.sin(E.a) * L;
}

/**
 * The Bubble Jet's wind-up puffs the cheeks (3.6: "head squash-x 1.1"), and the baby keeps them puffed while it
 * blows. Cranium space: a bulge of the skull's own silhouette at the lower back of the cranium, drawn only OUTSIDE
 * the cranium, so its fill covers the skull's ink there and its own ink continues the contour; it takes the skull's
 * own cel bands (parts.ts skullBands), so no seam shows where it joins.
 */
function cheekPuff(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  if (pose.act !== ACT.breath) return;
  const c = pose.cue, baby = info.stage === 'baby';
  const k = baby ? (c >= -6 && c < BABY_POP ? (c < -3 ? 1 : 2) : 0) : (c >= -12 && c < 0 ? (c < -8 ? 1 : 2) : 0);
  if (!k) return;
  const r = info.r, pr = r * 0.42, a = 118 * D2R, d = r - pr + k, b = skullBands(rig);
  ctx.save();
  ctx.beginPath(); ctx.rect(-40, -40, 80, 80); ctx.moveTo(r - 0.5, 0); ctx.arc(0, 0, r - 0.5, 0, Math.PI * 2);
  ctx.clip('evenodd');
  ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, pr, 0, Math.PI * 2);
  celPath(ctx, rig, info.pal.scale, b.cx, 0, b.ext, baby ? 0.34 : 0.22, 0.3);
  ctx.restore();
}

/**
 * The hungry tell (4.3: "licks its lips", while act = beg): every 2 s (the elder's 2.5 s) the tongue pokes out at
 * the front of the mouth, stretches forward, curls up against the snout's tip and goes back in, 4 stepped keys of 3 f
 * (the elder's 4 f; the curl stays under the snout's upper contour: 1 px higher, the ringed tongue sat on top of it
 * like a pink nose). Timed on the rig's clock with the pet's seed (the beg loop's own cue runs backward: see the
 * report), whole pixels in face space, `tongue` pink in a 4-neighbour ink ring (corners open, so it reads round, not
 * as a box).
 */
function lipLick(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  if (pose.act !== ACT.beg || rig.override) return;
  // (the elder's at its x 1.25 timing, 4.3: every 150 f on keys of 4 f)
  const elder = info.stage === 'elder', f = elder ? 4 : 3, t = (info.tick + info.seed * 29) % (elder ? 150 : 120) - 24;
  if (t < 0 || t >= 4 * f) return;
  const key = Math.floor(t / f), sn = rig.dims.head.snout;
  // the front of the mouth line: the snout's end circle, 58 deg below its front
  cranToRootPt(rig, sn.x1 + sn.r1 * 0.53, sn.y1 + sn.r1 * 0.85, R0);
  enterFaceFromCranium(ctx, rig, R0.x, R0.y);
  // [x, y, w, h] per key, face space from there: out, stretched forward, curled up against the tip, back in
  const x = key === 2 ? 1 : 0, y = key === 2 ? -1 : 0, w = key === 1 ? 3 : 2, h = key === 2 ? 3 : 2;
  ringedRect(ctx, rig, x, y, w, h, TONGUE, INK);
  ctx.restore();
}

// the one fin-ear, from behind the head (finEar); the near head features: the wind-up's cheek puff, the lip-lick
const farHead: ElementDraw = (ctx, rig, pose, info) => { finEar(ctx, rig, pose, info); };
const nearHead: ElementDraw = (ctx, rig, pose, info) => {
  cheekPuff(ctx, rig, pose, info);
  lipLick(ctx, rig, pose, info);
};

// ---------- the dorsal fin ----------

/**
 * Bible 3.6 "Dorsal fin" (young and adult; the adult's third scallop is part of its extra): low round scallops in
 * `membrane`, inked, <= 3 px (spike's back-line budget, 3.0). The folded wing lies along the upper back and its
 * spar tips on the rump (1.3), so the fin runs from just behind the wing's tips over the rump onto the tail root:
 * `from` / `to` are body-space px from the hip centre. Drawn here rather than by features.ts drawDorsalRow, whose
 * base is filled 2-3 px below the line: on the tail (drawn BEFORE the back row) that base lay over the tail's top
 * as a dark block with the scallops as 1 px teeth on it.
 */
const DORSAL: Readonly<Record<Stage, { h: number; n: number; from: number; to: number } | null>> = {
  baby: null,
  young: { h: 2, n: 2, from: -12, to: -3 },
  adult: { h: 3, n: 3, from: -17, to: -3 },
  elder: { h: 3, n: 3, from: -17, to: -3 },
};

/**
 * Body space, step 6 (before the body). Clipped to above the dorsal line (the back, or behind the rump the tail's
 * top: features.ts dorsalLineY) less half a pixel, so the fin stands ON the tail's ink instead of covering it, and
 * the body drawn next hides its root on the rump. Each scallop is a round arch (a cubic whose peak stands `h` proud
 * of the line) on a 1 px strip, so the fin reads as one continuous scalloped fin, not a row of teeth.
 */
const backRow: ElementDraw = (ctx, rig, pose, info) => {
  const dp = DORSAL[info.stage];
  if (!dp) return;
  const x0 = rig.hipB.x + dp.from, x1 = rig.hipB.x + dp.to, step = (x1 - x0) / dp.n;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0 - 3, -80);
  for (let x = x0 - 3; x <= x1 + 3; x += 1) ctx.lineTo(x, dorsalLineY(rig, x) - 0.5);
  ctx.lineTo(x1 + 3, -80); ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x0, dorsalLineY(rig, x0) + 2);
  for (let i = 0; i < dp.n; i++) {
    const ax = x0 + step * i, bx = ax + step, ay = dorsalLineY(rig, ax), by = dorsalLineY(rig, bx);
    // the rear scallop (on the tail) a little lower: the fin tapers toward the tail
    const h = ((i === 0 && dp.n > 2 ? dp.h - 0.5 : dp.h) - 1) * 1.33;
    ctx.lineTo(ax, ay - 1);
    ctx.bezierCurveTo(ax + step * 0.05, ay - 1 - h, bx - step * 0.05, by - 1 - h, bx, by - 1);
  }
  ctx.lineTo(x1, dorsalLineY(rig, x1) + 2);
  ctx.closePath();
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(info.pal.membrane); ctx.fill();
  ctx.restore();
};

// ---------- the spots ----------

/**
 * The pearl spots' colour this frame: three states, each >= 40 % from the next (gate h) -- `glow` when happy
 * (mood >= 0.5), `marking` at rest, the dim spot when sad or dry (mood <= -0.3). On top of that (3.6, 4.3):
 *   - the hungry beg dims them whatever the resting mood (the hungry tell);
 *   - asleep they are dim, and pulse one state up, to `marking`, at the top of each breath (the sleep loop's cue: its
 *     inhale is the first half);
 *   - awake at mood >= 0 they "breathe", stepping to `glow` for 30 f every 240 f (seeded phase), so a sad water
 *     dragon never flashes happy.
 * Every value is a palette slot or a module constant (element.ts: a stable string).
 */
function markingTone(info: DragonInfo, P: DragonPose, rig: DragonRig): string {
  let s = info.mood >= 0.5 ? 2 : info.mood <= -0.3 ? 0 : 1;
  if (P.act === ACT.beg) s = 0;
  else if (info.asleep) {
    // asleep the spots are dim, as its fins and fluke droop (3.6: "mood <= -0.3 and asleep"), whatever mood it fell
    // asleep in: at rest mood they stayed pearl and pulsed to the happy glow, a sleeper lit up like a happy one
    const B = rig.tune.sleep.breath;
    s = P.act === ACT.sleep && P.cue >= B * 0.28 && P.cue < B * 0.56 ? 1 : 0;
  } else if (info.mood >= 0 && s === 1 && (info.tick + info.seed * 37) % 240 < 30) s = 2;
  // (the dim spot is the stage's: rig.moodT, from the rig's greyed palette)
  return s === 2 ? info.pal.glow : s === 0 ? rig.moodT.dimSpot : info.pal.marking;
}

// Pearl spots along the lateral line: the first low on the rear flank (it shows at every stage: 2.7), the rest
// forward along the flank and back along the tail's side, where the line runs on. Each is 3 x 3 (5.2); the rig fits
// flank spots to where they show and the pet seed steps every spot after the first 1 px across the line, alternating
// up and down (build.ts), so the row reads as spots, not a dashed stripe.
//   The young carries 1 flank + 2 tail spots: its visible flank, between the folded wing and the leg roots, is one
// spot tall, so the fit set two flank spots side by side at one height on every seed, a pair (2.7).
//   The seed also shifts every spot after the first up to 2 px ALONG its anchor (build.ts `dx`), and the tail fit
// spaces tail spots by `t` alone, so the last tail spot is authored `dx` -2 (0-4 px toward the body): the seeded extra
// goes 0.14 further out, and a spot shifted 2 px toward it sat 1-2 px from it, a diagonal pair (adult, seed 3).
const spot = (t: number) => ({ kind: 'spot' as const, at: 'flank' as const, t, size: 3 });
const tailSpot = (t: number, dx = 0) => ({ kind: 'spot' as const, at: 'tail' as const, t, size: 3, dx });

// ---------- pixel bubbles, drops and dots ----------

/**
 * Whole-pixel bubble bitmaps for radius 1..BUB_MAX, built once: per row y (-r..r), the half-width of the disc
 * (pixels with x^2 + y^2 <= (r + 0.5)^2) and of its interior (the pixels whose 4 neighbours are all in the disc),
 * -1 where the row has none. Index r * 17 + y + 8.
 */
const BUB_MAX = 7;
const BUB_OUT = new Int8Array((BUB_MAX + 1) * 17).fill(-1), BUB_IN = new Int8Array((BUB_MAX + 1) * 17).fill(-1);
for (let r = 1; r <= BUB_MAX; r++) {
  const w = (y: number) => (Math.abs(y) > r ? -1 : Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - y * y)));
  for (let y = -r; y <= r; y++) {
    BUB_OUT[r * 17 + y + 8] = w(y);
    BUB_IN[r * 17 + y + 8] = Math.min(w(y) - 1, w(y - 1), w(y + 1));
  }
}

/**
 * A bubble at face-space (x, y), `sc` device px per sprite px (1 in face space; the top pass passes its own) and
 * mirrored by `mx` (+-1: the top pass's facing): a 1 px `membrane` ring (it reads on the pale floor), a `glow` fill
 * at alpha 0.45 and a 2 x 2 `#f8f4ec` highlight at the top-left interior, toward the light (3.6).
 */
function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sc: number, mx: number, ring: string, fill: string, hi: string | null): void {
  r = Math.max(1, Math.min(BUB_MAX, Math.round(r)));
  ctx.fillStyle = ring;
  for (let j = -r; j <= r; j++) {
    const w = BUB_OUT[r * 17 + j + 8], i = BUB_IN[r * 17 + j + 8];
    if (w < 0) continue;
    if (i < 0) ctx.fillRect(x - w * sc, y + j * sc, (2 * w + 1) * sc, sc);
    else { ctx.fillRect(x - w * sc, y + j * sc, (w - i) * sc, sc); ctx.fillRect(x + (i + 1) * sc, y + j * sc, (w - i) * sc, sc); }
  }
  if (!hi) return;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.45; ctx.fillStyle = fill;
  for (let j = -r; j <= r; j++) {
    const i = BUB_IN[r * 17 + j + 8];
    if (i >= 0) ctx.fillRect(x - i * sc, y + j * sc, (2 * i + 1) * sc, sc);
  }
  ctx.globalAlpha = a;
  if (r < 2) return;
  const hy = -r + 1 + (r >= 5 ? 1 : 0), hx = -BUB_IN[r * 17 + hy + 8];
  ctx.fillStyle = hi;
  ctx.fillRect(x + (mx > 0 ? hx : -hx - 1) * sc, y + hy * sc, 2 * sc, 2 * sc);
}

/** A pop (3.6: "2 f of a 4-dot star"): four 2 x 2 `membrane` dots on the axes at the bubble's radius. Face space. */
function drawPop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sc: number, ring: string): void {
  const d = Math.max(2, Math.round(r)) * sc;
  ctx.fillStyle = ring;
  ctx.fillRect(x - d - sc, y - sc, 2 * sc, 2 * sc); ctx.fillRect(x + d - sc, y - sc, 2 * sc, 2 * sc);
  ctx.fillRect(x - sc, y - d - sc, 2 * sc, 2 * sc); ctx.fillRect(x - sc, y + d - sc, 2 * sc, 2 * sc);
}

/** A w x h `fill` rect at face-space (x, y) in a 1 px 4-neighbour `ring` (corners open, so it reads round). */
function ringedRect(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, w: number, h: number, fill: string, ring: string): void {
  ctx.fillStyle = rig.col(ring);
  ctx.fillRect(x, y - 1, w, 1); ctx.fillRect(x, y + h, w, 1); ctx.fillRect(x - 1, y, 1, h); ctx.fillRect(x + w, y, 1, h);
  ctx.fillStyle = rig.col(fill); ctx.fillRect(x, y, w, h);
}

/**
 * A water drop at root (X, Y) (its centre), face space: in flight a 2 x 3 `glow` drop, on the floor (`landed`) a
 * 2 x 2 dot, both in a 1 px `membrane` ring (bare glow sat 12 % from the floor: 3.6). Never below the floor: the
 * ring's bottom row stays on the row above the ground line.
 */
function drawDrop(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, X: number, Y: number, landed: boolean): void {
  enterFace(ctx, rig, X, Math.min(Y, landed ? -2 : -3));
  ringedRect(ctx, rig, -1, -1, 2, landed ? 2 : 3, info.pal.glow, info.pal.membrane);
  ctx.restore();
}

// ---------- the Bubble Jet ----------

/**
 * Stream bubble radii in spawn order (3.6: r 2 to 5, the adult's one r 6 at the jet's middle), small and large
 * alternating so neighbours never merge. The adult's 9 fill the sustain (the last leaves at cue 35, the jaw open to
 * 36); its 8 of r 2-5 were a few small bubbles beside fire's flame (the cast review, round 2). The elder blows the
 * adult's 9 over its own sustain (the jaw open cue 0-38), then its finale ring (FINALE).
 */
const BUB_R: Readonly<Record<Stage, readonly number[]>> = { baby: [2], young: [2, 3, 2, 3], adult: [3, 2, 4, 2, 6, 2, 5, 3, 4], elder: [3, 2, 4, 2, 6, 2, 5, 3, 4] };
/**
 * Stream: frames between bubbles per stage, the first bubble's cue, px/f out of the mouth, life before the pop and
 * the pop's frames. Spread over the whole sustain (the jaw is open cue 0-36 adult, 0-27 young): every 3 f, all 4 of
 * the young's were out in the first 9 f and the open mouth then blew nothing. 4 f at 2.5 px/f puts neighbours 10 px
 * apart, >= 2 px of air between their rings with the cone (streamPos); the last pops before the anim hands back. The
 * elder's stream goes 1.1x as far on the same life (4.2: "the adult stream at 1.1x reach"), 11 px apart.
 */
const STREAM = {
  every: { baby: 0, young: 6, adult: 4, elder: 4 } as Readonly<Record<Stage, number>>,
  speed: { baby: 2.5, young: 2.5, adult: 2.5, elder: 2.75 } as Readonly<Record<Stage, number>>,
  first: 3, life: 18, pop: 2,
};
/**
 * The elder's breath FINALE (4.2, required: 2.6's "a breath that never fails and ends in one ring"): the cue its ring
 * leaves the mouth at and its frames. anims.ts elderBreath keys cue 0 at the snap's first frame, f 22, so the stream
 * (fx 1) runs to cue 38 and the finale, f 60-72 with the jaw easing from 28 to 16 deg and held, is cue 38-50
 * (anims.ts ELDER_FINALE); the ring lives on into the recover and is gone by cue 60, inside the 84 f anim (cue 62).
 */
const FINALE = { at: ELDER_FINALE.at, life: 22, pop: 2 };
/** Droplets shed off the jaw under the stream: adult 4 (3.6), young 2 (half strength). */
const DROPS: Readonly<Record<Stage, number>> = { baby: 0, young: 2, adult: 4, elder: 4 };
/** The baby's bubble: it grows r 2 -> 6 over 30 f from the snap (3.6), wobbles a moment at full size, pops. */
const BABY_GROW = 30, BABY_POP = 34;
/**
 * The pop's 4 drops, (vx, vy) px/f in root space (+x forward, -y up) and the frames each flies before it lands (its
 * gravity is solved for that, so every drop is down by cue 54 and has lain its 4 f before the anim ends at 58): high
 * and nearly straight up, a forward arc, a quick drop forward and down, and a short hop back by its chin. (One thrown
 * up and BACK flew into the eye's box, where the rig's eye clip ate it; fanned out on one flight time, or on three
 * arcs that happened to line up, the drops read as a bead chain.)
 */
const SPLASH: readonly number[] = [0.2, -2.2, 20, 1.6, -1.0, 13, 0.9, 0.3, 8, -0.3, -0.6, 11];

/**
 * Where stream bubble k sits at `age` f, root space, into `out`: out along the snout on its own seeded bearing, 8-12
 * deg to alternate sides of the snout line (a cone: in one line the r 2-5 bubbles touched, a bead chain), rising
 * 0.2 px/f with a +-1 px wobble stepped every 4 f.
 */
function streamPos(rig: DragonRig, info: DragonInfo, k: number, age: number, out: { x: number; y: number }): void {
  const J = rig.j, a = ((k % 2 ? 1 : -1) * (8 + 4 * hash01(info.seed + 11, k)) + info.ang) * D2R;
  const d = 3 + age * STREAM.speed[info.stage], wob = (Math.floor(age / 4) + k) % 2 ? 1 : -1;
  out.x = J.mouth.x + Math.cos(a) * d; out.y = J.mouth.y + Math.sin(a) * d - age * 0.2 + wob;
}

/**
 * Bible 3.6 "Signature: Bubble Jet". Mouth space (+x out of the mouth); particles are placed in root space from the
 * mouth and drawn as whole pixels in face space. Called every frame (element.ts):
 *   - breath, young / adult: the STREAM through the sustain, one bubble every 4 f (young 6) moving out of the mouth
 *     at 2.5 px/f in a cone (streamPos), rising 0.2 px/f with a +-1 px wobble stepped every 4 f, popping (2 f) at
 *     18 f -- a pop is skipped within 2 px of a live bubble's ring (a star beside a bubble read as beads); adult 9
 *     bubbles r 2-6, young 4 r 2-3 (half strength), each swelling from r 1 as it leaves the lip; and DROPLETS
 *     (adult 4, young 2) shed off the jaw in a fan of arcs under the stream, landing on the floor as ringed dots.
 *     (The wind-up's cheek puff and fin flare are nearHead's and finEar's.)
 *   - breath, elder: the adult's stream at 1.1x reach over its longer sustain, then the FINALE (4.2): the last puff
 *     leaves the lip as a bubble and opens into one bubble ring that widens and drifts out and up while the jaw eases
 *     shut, and pops (ringAt, drawRing);
 *   - breath, baby: one big bubble grows on its own snout, r 2 -> 6 over 30 f, wobbles, and pops in its face at
 *     BABY_POP: a 4-dot star and a splash of 4 drops that land by cue 54 (each one's gravity solved for it) and lie
 *     4 f; the anim then blinks and turns happy (babyBreath).
 *   - asleep: a nostril bubble on each exhale (4.3), r 2 -> 4 over the exhale, popping (3 f) as it ends.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (rig.override) return;
  const J = rig.j, c = pose.cue;
  if (pose.act === ACT.sleep && info.asleep) {
    // the sleeping nostril bubble: the exhale is the loop's second half (anims.ts sleepAnim)
    const B = rig.tune.sleep.breath, t = c - B / 2;
    if (t < 0) return;
    const sn = rig.dims.head.snout, pop = t >= B / 2 - 3;
    const r = pop ? 4 : 2 + Math.min(2, Math.floor(3 * t / (B / 2 - 3)));
    cranToRootPt(rig, sn.x1 + sn.r1 + r - 1.5, sn.y1 - sn.r1 * 0.35 - (pop ? 0 : r * 0.3), R0);
    enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, J.mouthAng, R0.x, R0.y);
    if (pop) drawPop(ctx, 0, 0, r, 1, info.pal.membrane); else drawBubble(ctx, 0, 0, r, 1, 1, info.pal.membrane, info.pal.glow, PEARL);
    ctx.restore();
    return;
  }
  if (pose.act !== ACT.breath) return;
  const st = info.stage;
  if (st === 'baby') {
    if (c < 0 || c > BABY_POP + 24) return;
    if (c < BABY_POP) {
      // grows in whole-pixel steps; at full size it wobbles 1 px (about to go)
      const r = Math.min(6, 2 + Math.floor(4 * c / BABY_GROW)), wob = c >= BABY_GROW && c % 2 ? 1 : 0;
      // (its back edge on the mouth, just clear of the eye's box: 1.4 step 13 clips anything over it)
      localToRootPt(J.mouth.x, J.mouth.y, info.ang, r + 0.5, -wob, R0);
      enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, info.ang, R0.x, R0.y);
      drawBubble(ctx, 0, 0, r, 1, 1, info.pal.membrane, info.pal.glow, PEARL);
      ctx.restore();
      return;
    }
    const age = c - BABY_POP;
    localToRootPt(J.mouth.x, J.mouth.y, info.ang, 6.5, 0, R0);
    if (age < 2) {
      enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, info.ang, R0.x, R0.y);
      drawPop(ctx, 0, 0, 7, 1, info.pal.membrane);
      ctx.restore();
    }
    // the splash: 4 drops burst out of the pop and fall to the floor, each on the gravity that lands it on time,
    // lying there 4 f (on one gravity the high drop still hung 9 px up when the anim handed back to idle)
    for (let k = 0; k < 4; k++) {
      const vx = SPLASH[k * 3], vy = SPLASH[k * 3 + 1], T = SPLASH[k * 3 + 2];
      if (age >= T + 4) continue;
      const g = Math.max(0.05, 2 * (-3 - R0.y - vy * T) / (T * T)), t = Math.min(age, T);
      mouthDrop(ctx, rig, info, R0.x + vx * t, R0.y + vy * t + g * t * t / 2, age >= T);
    }
    return;
  }
  if (c < 0) return;
  const R = BUB_R[st], n = R.length, every = STREAM.every[st], life = STREAM.life;
  // the elder's finale ring, when it is out: its centre (RING) and outer radius (RING.r)
  const fa = st === 'elder' ? c - FINALE.at : -1, ring = fa >= 0 && fa < FINALE.life - FINALE.pop;
  if (ring) ringAt(rig, info, fa, RING);
  for (let k = 0; k < n; k++) {
    const age = c - STREAM.first - every * k;
    if (age < 0 || age >= life + STREAM.pop) continue;
    streamPos(rig, info, k, age, R0);
    if (age >= life) {
      // the pop's 4 dots reach max(2, r) + 1 px out: none within 2 px of a live bubble's ring
      let clear = true;
      for (let j = 0; j < n && clear; j++) {
        const aj = c - STREAM.first - every * j;
        if (j === k || aj < 0 || aj >= life) continue;
        streamPos(rig, info, j, aj, R1);
        if (Math.hypot(R1.x - R0.x, R1.y - R0.y) < Math.max(2, R[k]) + 1 + R[j] + 0.5 + 2) clear = false;
      }
      // (nor within 2 px of the finale ring)
      if (ring && Math.hypot(RING.x - R0.x, RING.y - R0.y) < Math.max(2, R[k]) + 1 + RING.r + 0.5 + 2) clear = false;
      if (!clear) continue;
    }
    enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, info.ang, R0.x, R0.y);
    // (blown out small, a bubble swells 1 px every 2 f to its size: a full r 5 bubble on the lip crowded the mouth)
    if (age >= life) drawPop(ctx, 0, 0, R[k], 1, info.pal.membrane);
    else drawBubble(ctx, 0, 0, Math.min(R[k], 1 + (age >> 1)), 1, 1, info.pal.membrane, info.pal.glow, PEARL);
    ctx.restore();
  }
  // the droplets (3.6: "4, each 2 x 3 in glow with a 1 px membrane ring, in an arc"): spray shed off the lower jaw
  // in a fan of arcs falling UNDER the stream to the floor, where they lie as ringed dots for 6 f. (Thrown up and
  // forward, they flew through the stream and sat on the bubbles' rings as beads.) Launched between bubbles.
  for (let k = 0; k < DROPS[st]; k++) {
    const age = c - 5 - 8 * k;
    if (age < 0) continue;
    // 30 to 60 deg below level, 1.4-1.7 px/f (g 0.18: every drop has landed, and lain its 6 f, before the breath
    // hands back to idle)
    const a = (30 + 10 * ((k * 3) % 4)) * D2R, v = 1.7 - 0.1 * k, g = 0.18;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    const X0 = J.mouth.x + 1, Y0 = J.mouth.y + 4, land = (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, -3 - Y0))) / g;
    if (age > land + 6) continue;
    const t = Math.min(age, land);
    mouthDrop(ctx, rig, info, X0 + vx * t, Y0 + vy * t + g * t * t / 2, age >= land);
  }
  if (fa >= 0 && fa < FINALE.life) {
    ringAt(rig, info, fa, RING);
    enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, info.ang, RING.x, RING.y);
    if (fa >= FINALE.life - FINALE.pop) ringPop(ctx, RING.r, info.pal.membrane);
    else if (RING.b) drawBubble(ctx, 0, 0, RING.b, 1, 1, info.pal.membrane, info.pal.glow, PEARL);
    else drawRing(ctx, rig, RING.r, info.pal.membrane, info.pal.glow, PEARL);
    ctx.restore();
  }
};

/**
 * The elder's FINALE ring `a` f after FINALE.at, root space, into `out`: its centre (x, y), its outer radius r and,
 * while it is still the jet's last puff, the radius b of that bubble (0 once it has opened). The last puff leaves
 * the lip as a bubble (r 2, then 3) and opens into ONE ring (4.2) that widens in whole-pixel steps, r 5 / 6 / 7 at
 * 4 / 8 / 13 f (a hole 3, 5 and 7 px across), while it drifts out along the snout, slowing, and rises ever faster,
 * buoyant (16 px out and 13 up by the end), and at FINALE.life - FINALE.pop it pops as a bubble does. The jaw eases
 * from 28 to 16 deg as it goes: the old dragon blows it, unhurried, and watches it rise.
 */
function ringAt(rig: DragonRig, info: DragonInfo, a: number, out: { x: number; y: number; r: number; b: number }): void {
  const J = rig.j, u = a / FINALE.life, d = 3 + 16 * (1 - (1 - u) * (1 - u)), rise = 3 * u + 10 * u * u, h = info.ang * D2R;
  out.b = a < 2 ? 2 : a < 4 ? 3 : 0;
  out.r = out.b || (a < 8 ? 5 : a < 13 ? 6 : 7);
  out.x = J.mouth.x + Math.cos(h) * (d + out.r - 2); out.y = J.mouth.y + Math.sin(h) * (d + out.r - 2) - rise;
}
const RING = { x: 0, y: 0, r: 0, b: 0 };

/** Whole pixel (i, j) within the disc of radius r about the origin: x^2 + y^2 <= (r + 0.5)^2, as the bubbles are. */
function inDisc(i: number, j: number, r: number): boolean { return r >= 0 && i * i + j * j <= (r + 0.5) * (r + 0.5); }
/**
 * What pixel (i, j) of a ring of outer radius R is: 0 outside, 1 its 1 px line (the rim's pixels with a 4-neighbour
 * outside the disc or in the hole), 2 its band, 3 the hole (radius R - 4), so the band is 2 px between the lines.
 */
function ringCls(i: number, j: number, R: number): number {
  const h = R - 4;
  if (!inDisc(i, j, R)) return 0;
  if (inDisc(i, j, h)) return 3;
  if (!inDisc(i - 1, j, R) || !inDisc(i + 1, j, R) || !inDisc(i, j - 1, R) || !inDisc(i, j + 1, R)) return 1;
  if (inDisc(i - 1, j, h) || inDisc(i + 1, j, h) || inDisc(i, j - 1, h) || inDisc(i, j + 1, h)) return 1;
  return 2;
}

/**
 * The finale's BUBBLE RING, face space about its centre pixel, radius R: a water bubble drawn as a ring (4.2: "one
 * ring ... 2 px thick, in the element's floor-safe colours"), the bubble's own recipe -- a 1 px `membrane` line on
 * each side (it reads on the pale floor), the 2 px band a `glow` fill at alpha 0.45 and a 2 x 2 `#f8f4ec` glint on the
 * band at its top-left, toward the light -- round a hole that shows the room. Whole pixels, in runs.
 */
function drawRing(ctx: CanvasRenderingContext2D, rig: DragonRig, R: number, line: string, band: string, hi: string): void {
  const a = ctx.globalAlpha;
  for (let pass = 1; pass <= 2; pass++) {
    ctx.fillStyle = rig.col(pass === 1 ? line : band);
    if (pass === 2) ctx.globalAlpha = a * 0.45;
    for (let j = -R; j <= R; j++) {
      let run = -R - 1;
      for (let i = -R; i <= R + 1; i++) {
        const on = i <= R && ringCls(i, j, R) === pass;
        if (on && run < -R) run = i;
        else if (!on && run >= -R) { ctx.fillRect(run, j, i - run, 1); run = -R - 1; }
      }
    }
  }
  ctx.globalAlpha = a;
  // the glint: the band's pixels of the 2 x 2 at its top-left, 45 deg up and back
  const g = Math.ceil(-(R - 1.5) * Math.SQRT1_2);
  ctx.fillStyle = rig.col(hi);
  for (let j = g - 1; j <= g; j++) for (let i = g - 1; i <= g; i++) if (ringCls(i, j, R) === 2) ctx.fillRect(i, j, 1, 1);
}

/**
 * The ring's pop (a bubble's 4-dot star, grown): eight 2 x 2 `membrane` dots just outside its rim, every 45 deg, 2 f.
 * Face space.
 */
function ringPop(ctx: CanvasRenderingContext2D, R: number, ring: string): void {
  ctx.fillStyle = ring;
  for (let k = 0; k < 8; k++) {
    const x = Math.round(Math.cos(k * Math.PI / 4) * R), y = Math.round(Math.sin(k * Math.PI / 4) * R);
    ctx.fillRect(x - 1 + (x > 0 ? 1 : 0), y - 1 + (y > 0 ? 1 : 0), 2, 2);
  }
}

/** drawDrop from the breath anchor (mouth space): walked back to root space first. */
function mouthDrop(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, X: number, Y: number, landed: boolean): void {
  const J = rig.j;
  ctx.save();
  ctx.rotate(-info.ang * D2R); ctx.translate(-J.mouth.x, -J.mouth.y);
  drawDrop(ctx, rig, info, X, Y, landed);
  ctx.restore();
}

// ---------- ambient ----------

const DRIP_AGES = new Float32Array(3), DRIP_IDS = new Int32Array(3);
const SCR = { x: 0, y: 0 };
/** Drip: every 180 +- 60 f (3.6), hangs 12 f, then falls (0.15 px/f^2) and splashes where it lands. */
const DRIP = { every: 180, jitter: 60, hang: 12, g: 0.15, splash: 10, life: 60 };

/** Root space: the front-most x of what stands under the head -- the chest ball, the neck and the front legs. */
function bodyFront(rig: DragonRig): number {
  const J = rig.j;
  let x = J.chest.x + rig.dims.chestR;
  for (let k = 0; k <= J.neckN; k++) x = Math.max(x, J.neckX[k] + J.neckR[k]);
  for (let k = 1; k < 4; k += 2) x = Math.max(x, J.legs[k].knee.x + 3, J.legs[k].ankle.x + 4);
  return x;
}

/**
 * The happy flourish's bubbles per stage: frames apart, life before the 2 f pop, rise px/f. The third pops inside
 * the happy's own cue (4.2: cue 0 is the flourish; the cue runs to 54 baby, 56 young, 58 adult, 66 elder): at the
 * adult's 12 / 34 the young's and the baby's third was still rising when the anim cut to idle and vanished in the
 * air (the elder review). Each is 8 px or more above the one before it (every x rise), so its ring keeps 2 px of air
 * whatever the fan (HAPPY_FAN) does across.
 */
const HAPPY_BUB: Readonly<Record<Stage, { every: number; life: number; rise: number }>> = {
  baby: { every: 10, life: 28, rise: 0.8 },
  young: { every: 11, life: 30, rise: 0.75 },
  adult: { every: 12, life: 32, rise: 0.7 },
  elder: { every: 14, life: 36, rise: 0.62 },
};
/**
 * The trio's fan, per bubble: where it is born across from the others (px, + forward) and its drift (px/f). The
 * first leans out ahead, the second back over the snout, the third out again, so the three rise in a loose zig-zag
 * 3.5 px or more apart across: from one point on one drift they rose as a stacked column, a snowman (the review).
 */
const HAPPY_FAN: readonly number[] = [0, 0.25, 0, -0.05, 3, 0.15];

/** Top-pass draw: one rising bubble of the happy flourish (it.a = radius, it.b = 1 for its pop). */
function topBubble(ctx: CanvasRenderingContext2D, it: TopItem): void {
  if (it.b) drawPop(ctx, it.x, it.y, it.a, it.sc, it.c1);
  else drawBubble(ctx, it.x, it.y, it.a, it.sc, it.facing, it.c1, it.c0, PEARL);
}

/**
 * Bible 3.6 "Ambient" and the 4.3 flourishes, root space:
 *   - the DRIP: every 180 +- 60 f (seeded, through the ambient budget, stretched in a crowd: 5.4) a drop gathers at
 *     the chin, or the fin-ear's tip where that hangs clear of the body, falls to the floor and splashes into 2
 *     ringed dots (never down the front of the dragon: a source over the body skips its drip). Only
 *     awake, standing (a drip falling in root space while it walks would skate along with it) and not dry (mood >
 *     -0.3: a sad or dry dragon has no water to drip), and never over another act's effect;
 *   - the SHAKE's droplets while the fidget plays (act = fidget): 8 (young 6, baby 4) flung off the head, back and
 *     tail in pairs, in arcs forward and back, landing by L - 4 and lying on the floor;
 *   - the HAPPY flourish (act = happy, from cue 0): 3 bubbles, 10-14 f apart (HAPPY_BUB), born ahead of the snout, rise
 *     in a fan through the top pass (1.4 step 14), wobbling, and pop at the top before the anim ends.
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  const J = rig.j, d = rig.dims, act = pose.act;
  if (act === ACT.fidget) {
    const st = info.stage, k = SHAKE_K[st], n = SHAKE_DROPS[st], L = shakeLen(st);
    for (let i = 0; i < n; i++) {
      const t0 = Math.round((4 + (i >> 1) * 4) * k), age = pose.cue - t0;
      if (age < 0) continue;
      const h1 = hash01(info.seed + 5, i), h2 = hash01(info.seed + 9, i), side = i % 2 ? 1 : -1;
      // from along the back line, the head (i = 1, 5) and the tail root (i = 2, 6)
      const src = i & 1 && (i >> 1) % 2 === 0 ? 1 : (i >> 1) % 2 === 1 && !(i & 1) ? 2 : 0;
      const x0 = src === 1 ? J.cran.x : src === 2 ? J.tailX[1] : J.body.x + (h1 - 0.5) * d.bodyLen;
      const y0 = src === 1 ? J.cran.y - d.head.cranR * 0.6 : src === 2 ? J.tailY[1] - 3 : J.body.y - d.chestR;
      // flung out in an arc whose gravity is solved so it lands by L - 4 (a drop still in the air when the fidget
      // hands back to idle vanishes mid-flight: the baby's timings were scaled, its fall was not)
      const vx = side * (1.0 + 1.1 * h2), vy = -(1.1 + 0.8 * h1), T = Math.min(24, L - 4 - t0);
      const g = Math.max(0.22, 2 * (-3 - y0 - vy * T) / (T * T));
      const land = (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, -3 - y0))) / g;
      if (age > land + 6) continue;
      const t = Math.min(age, land);
      drawDrop(ctx, rig, info, x0 + vx * t, y0 + vy * t + g * t * t / 2, age >= land);
    }
    return;
  }
  if (act === ACT.happy && rig.top && pose.cue >= 0) {
    // 3 bubbles born just AHEAD of the snout's tip, 2 px clear of it at the mouth's height (on the snout, at the
    // mouth + 4, the first read as the sleeping nostril bubble: the review), rising in a fan (HAPPY_FAN) and popping
    // inside the anim (HAPPY_BUB). Each wobbles 1 px on a beat of `every` f, the three in step (they are `every` f
    // apart), so the wobble never closes a gap. Anchored to the body, not the hop (tf.ry): a young or baby hop does
    // not carry them into the air with it
    const F = HAPPY_BUB[info.stage], sn = d.head.snout;
    for (let k = 0; k < 3; k++) {
      const age = pose.cue - F.every * k, r = k === 1 ? 3 : 2;
      if (age < 0 || age >= F.life + 2) continue;
      const wob = Math.floor(age * 2 / F.every) % 2 ? 1 : -1;
      cranToRootPt(rig, sn.x1 + sn.r1 + r + 3 + HAPPY_FAN[k * 2], sn.y1 + sn.r1 * 0.9, R1);
      // (never nearer the snout's tip than 2 px of air: a baby's head flops forward as it lands from its hop)
      cranToRootPt(rig, sn.x1 + sn.r1, sn.y1, R0);
      const X = Math.max(R1.x + HAPPY_FAN[k * 2 + 1] * age + wob, R0.x + r + 2.5);
      rootToScreen(rig, X, R1.y - age * F.rise - rig.tf.ry, SCR);
      const it = rig.top.push(topBubble, SCR.x, SCR.y, rig.pxScale, rig.facing);
      if (it) { it.a = r; it.b = age >= F.life ? 1 : 0; it.c0 = info.pal.glow; it.c1 = info.pal.membrane; }
    }
    return;
  }
  if (info.asleep || info.mood <= -0.3 || (act !== ACT.none && act !== ACT.variant && act !== ACT.pet)) return;
  const n = liveSpawns(info.seed + 3, info.tick, DRIP.every * rig.budget.stretch, DRIP.jitter, DRIP.life, DRIP_AGES, DRIP_IDS);
  const allowed = rig.budget.take(rig.slot, n);
  for (let i = 0; i < allowed; i++) {
    // (spawn 0 would drip in every pet's first second, on every cell of a contact sheet)
    if (!DRIP_IDS[i]) continue;
    const age = DRIP_AGES[i];
    // the source: the fin-ear's tip (every other drip) where it hangs clear of the body in x, else the chin (the
    // jaw's tip, underneath); a drop over the body would slide down neck, chest and leg, drawn on them: no drip
    let clear = false;
    if (DRIP_IDS[i] % 2) {
      earTip(rig, pose, info, FP); cranToRootPt(rig, FP.x, FP.y, R1);
      clear = R1.x > bodyFront(rig) + 2;
    }
    if (!clear) {
      const jw = d.head.jaw;
      cranToRootPt(rig, jw.tx - 1, jw.ty + jw.r1, R1);
      if (R1.x <= bodyFront(rig) + 2) continue;
    }
    const X = Math.round(R1.x), Y0 = R1.y + 1.5;
    if (age < DRIP.hang) { drawDrop(ctx, rig, info, X, Y0 + (age < DRIP.hang / 2 ? -0.5 : 0.5), false); continue; }
    const t = age - DRIP.hang, fall = Math.sqrt(2 * Math.max(0, -3 - Y0) / DRIP.g);
    if (t < fall) { drawDrop(ctx, rig, info, X, Y0 + DRIP.g * t * t / 2, false); continue; }
    const s = t - fall;
    if (s >= DRIP.splash) continue;
    // the splash: 2 ringed dots hopping apart on the floor
    const hop = s < 4 ? 1 : 0, spread = 2 + Math.floor(s / 2);
    drawDrop(ctx, rig, info, X - spread, -2 - hop, true);
    drawDrop(ctx, rig, info, X + spread + 1, -2 - hop, true);
  }
};

// ---------- anims ----------

/**
 * The shake's timing scale per stage (3.6: 36 f, young x 0.85, baby x 0.6; the elder's x 1.3, its whips at 0.8x:
 * FIDGET_TIMING, 4.2) and its droplets (8 on a baby: a rash).
 */
const SHAKE_K: Readonly<Record<Stage, number>> = { baby: FIDGET_TIMING.baby.dur, young: FIDGET_TIMING.young.dur, adult: FIDGET_TIMING.adult.dur, elder: FIDGET_TIMING.elder.dur };
const SHAKE_DROPS: Readonly<Record<Stage, number>> = { baby: 4, young: 6, adult: 8, elder: 8 };
/** The fidget's length: the shake, scaled, plus a 10 f settle that is never scaled (the last drops land in it). */
function shakeLen(stage: Stage): number { return Math.round(36 * SHAKE_K[stage]) + 10; }

/**
 * Bible 3.6 "Idle fidget: a dog-style shake that throws droplets (36 f)" (young x 0.85, baby x 0.6), plus a 10 f
 * settle, never scaled, for the last drops to land. It braces (a squash down, eyes shut), then the shake runs head
 * -> body -> tail: the head whips +-10 deg on 2 f beats, the body wobbles (squash 0.97 <-> 1.03, a +-2 deg rock
 * about the ground point with the planted paws counter-rotated), the tail whips +-14 on 3 f beats; it settles with
 * a pleased `happy` face. ambient() flings the droplets. The ELDER's (FIDGET_TIMING, 4.2) runs x 1.3, 57 f with its
 * settle, every gesture at 0.8x -- the brace, the whips, the wobble, the rock -- and flings the adult's 8 drops: an
 * unhurried shake with a contented end, never a shiver (D21).
 */
function fidget(stage: Stage): DragonAnim {
  const k = SHAKE_K[stage], g = FIDGET_TIMING[stage].amp, L = shakeLen(stage), t = (f: number) => Math.round(f * k);
  const hd: [number, number][] = [[0, 0], [t(3), 4 * g]], sq: [number, number][] = [[0, 1], [t(3), 1 - 0.03 * g]];
  const rot: [number, number][] = [[0, 0]], tl: [number, number][] = [[0, 0]];
  for (let f = 4, i = 0; f < 26; f += 2, i++) { hd.push([t(f), (i % 2 ? -10 : 10) * g]); sq.push([t(f + 4), 1 + (i % 2 ? -0.03 : 0.03) * g]); }
  for (let f = 6, i = 0; f < 28; f += 3, i++) { rot.push([t(f), (i % 2 ? -2 : 2) * g]); tl.push([t(f + 3), (i % 2 ? -14 : 14) * g]); }
  hd.push([t(28), 0]); sq.push([t(30), 1]); rot.push([t(29), 0]); tl.push([t(32), 0]);
  return bake({
    'head.rot': hd, squash: sq, 'root.rot': rot, 'tail.sway': tl,
    'neck.a0': [[0, 0], [t(3), 4 * g], [t(26), 2 * g], [t(30), 0]],
    'tail.stiff': [[0, 0], [t(4), 0.5], [t(28), 0.5], [L, 0]],
    face: [[0, DFACE.neutral], [t(3), DFACE.closed], [t(28), DFACE.happy], [t(42), DFACE.neutral]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * The BABY'S breath (4.2 "every baby breath fails, adorably"; 3.6: "one big bubble grows on its own snout, r 2 -> 6
 * over 30 f, then pops in its face (blink, happy)"), 66 f: the shared 36 f baby breath has no room for a 30 f bubble.
 * Wind-up 0-8: it tips its head back and puffs up (squash 1.06, the cheeks puffed: cheekPuff); from the snap (f 8,
 * cue 0) the jaw is open at its 20 deg minimum and the bubble grows on its snout while it leans away from it, eyes
 * going wide (`surprised`) as it gets big; at cue 34 it pops -- a scrunch (squash 0.9), a 3 px sneeze-back, eyes
 * squeezed shut -- then `happy` with the tongue out (the baby smile: 2.5) and a perky tail.
 */
function babyBreath(): DragonAnim {
  const N = DFACE.neutral, pop = 8 + BABY_POP;
  return bake({
    'head.rot': [[0, 0], [8, -6, 'out'], [16, -4], [pop - 2, -10], [pop + 2, -1, 'out'], [pop + 8, -4], [66, 0]],
    'body.rot': [[0, 0], [8, -3], [pop - 2, -6], [pop + 4, 0]],
    squash: [[0, 1], [8, 1.06, 'out'], [pop - 2, 1.02], [pop, 0.9, 'out'], [pop + 4, 1.05], [pop + 10, 1]],
    'root.x': [[0, 0], [8, 0], [pop - 2, -1], [pop + 1, -3, 'out'], [pop + 10, -3], [66, 0]],
    jaw: [[0, 0], [6, 0], [8, 20], [pop, 20], [pop + 1, 0], [pop + 6, 0], [pop + 7, 20], [62, 20], [63, 0]],
    fx: [[0, 0], [8, 0, 'linear'], [9, 1], [pop, 1, 'linear'], [pop + 1, 0]],
    'tail.lift': [[0, 0], [8, -4], [pop, -4], [pop + 6, -10], [66, 0]],
    'tail.stiff': [[0, 0], [6, 1], [pop, 1], [pop + 12, 0]],
    face: [[0, N], [pop, DFACE.closed], [pop + 6, DFACE.happy], [64, N]],
    act: [[0, ACT.breath]], cue: [[0, -8], [66, 58]],
  }, { stage: 'baby', len: 66, next: 'idle' });
}

export const WATER: ElementSpec = {
  id: 'water',
  name: 'Ripple',
  blurb: 'Gentle, curious and playful. It loves baths, sings in bubbles and floats belly-up in the pond.',
  palette: PAL,
  modifiers: { bodyLength: 1.1, bodyDepth: 0.9, legLength: 0.8, legR: 1.0, neckLength: 1.3, neckAngle: 0, tailLength: 1.15, tailR: 1.0, snout: 1.0 },
  stages: {
    baby: {
      // tipBox: round the fluke at its flare and its droop, ink included (tipBox()): the rig lifts the tail's end so
      // it never hangs through the floor, asleep, begging with the tail down or plopped on its rump (1.1, 5.1 #14)
      tailRest: TAIL_REST.water.baby, tailR: [3.5, 1.5], tipBox: tipBox('baby'), horns: null, markings: [spot(-0.1), tailSpot(0.5)],
      wing: wingParams({ style: 'fin', plus: true, scallop: -2 }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.water.young, tipBox: tipBox('young'), horns: null, markings: [spot(-0.1), tailSpot(0.18), tailSpot(0.52, -2)],
      wing: wingParams({ style: 'fin', plus: true, scallop: -2 }), dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.water.adult, tipBox: tipBox('adult'), horns: null,
      markings: [spot(-0.1), spot(0.3), spot(0.7), tailSpot(0.2), tailSpot(0.45, -2)],
      wing: wingParams({ style: 'fin', plus: true, scallop: -3 }), dorsal: null,
    },
    // the elder (3.6's Elder column): the neck capped x 0.92 (<= 1.08x the adult's length, 2.3) and carried 4 deg
    // higher (the long neck at 52 / 22 set the head 6 px under the adult's on the silhouette sheet, past 2.1's 3 to 5:
    // the elder core review), the adult's spots (greyed at half strength), the fin worn: ragged 5 x 4 notches in
    // panels 1 and 3 and the notched hole at full spread (2.9: panel 1, the fin's rounded back end at the resting
    // spread, opens 8 px of the room there; panel 2, like 3, lay over the back and opened none, the elder core review,
    // round 2). Its cue grown and its elder-only extra, the 18 x 9 fluke with its pearls: FLUKE (tipBox follows it)
    elder: {
      tailRest: TAIL_REST.water.elder, tipBox: tipBox('elder'), horns: null, neckLen: 0.92, neckAngle: 4,
      markings: [spot(-0.1), spot(0.3), spot(0.7), tailSpot(0.2), tailSpot(0.45, -2)],
      wing: wingParams({
        style: 'fin', plus: true, scallop: -3,
        tears: [{ panel: 1, at: 0.5, depth: 4 }, { panel: 3, at: 0.4, depth: 4 }],
        // (2.9's spot re-measured for the notched window AND the airing: at 2.9's (-10.5, -7) the window lay on the back once
        // the airing leaned the spread back far enough for the tip rule (1.3); here, up the arm panel toward the
        // forearm, it keeps the ring and 2 px of membrane round it and clears the back line at the airing's 20 deg
        // sit-back, anims.ts airingFit)
        hole: { x: -7.5, y: -10, from: 0.9 },
      }),
      dorsal: null,
    },
  },
  render: { tailTip, farHead, nearHead, backRow, breath, ambient },
  markingTone,
  anims: {
    // 4.3 "Water": the slinky walk is tuning (body pitch +-2, an S-wave through neck and tail 8 f behind the legs);
    // the happy flourish (3 bubbles, the fin-ears flare on the happy's mood), the hungry tell (the spots dim, the lip
    // lick), the sleeping spot pulse and nostril bubble are renderers keyed on act / cue; the baby's bubble is an
    // override (babyBreath); the shake is the fidget; the elder's finale ring is the breath renderer's (FINALE).
    // ("Floats belly-up if in water" waits for a pond: the habitat has no water surface yet.)
    fidget,
    overrides: (st) => (st === 'baby' ? { breath: babyBreath() } : {}),
    tuning: (st) => ({
      // the swim-walk's body sway and the S-wave's lag behind the legs; the elder keeps its column at the elder's
      // timing (4.3, 4.1): the wave 10 f behind the legs on its 64 f cycle (the adult's 8 x 1.25, the same lag as its
      // head), the sway at the elder's 0.8x amplitude
      walk: { sway: st === 'baby' ? 1 : st === 'elder' ? 1.6 : 2, wave: st === 'adult' ? 8 : st === 'young' ? 7 : st === 'elder' ? 10 : 4 },
      // asleep the long tail lies out along the floor, so the fluke (the cue) stands clear of it (the baby too: not
      // the bun's default wrap under the body, which would hide its paddle)
      sleep: st === 'baby' ? { tailCurl: 3, tailLift: 14 } : { tailCurl: 3 },
      breath: { fizzleFace: 'happy' },
    }),
  },
};
