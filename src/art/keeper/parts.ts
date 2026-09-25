// The keepers' part hooks for the engine's humanoid rig (src/lib/art/rig.ts RigParts), docs/KEEPERS.md 4: the hair
// and hats, the beard, the face set, the clothes, the shoes and the tools a keeper holds. rig.ts calls each in its
// part's own local space, exactly as it calls its own defaults, so a keeper is drawn in the engine's draw order with
// the engine's shading (the 1 px ink, the cel bands lit from the top-left, the THIN_R / HI_MIN / FLAT_R gates); the
// dragons' house rules apply on top (bible 1.6: a separate object is inked, pigment is not; 5.2: no mark under 2 px).
//
// What replaces the engine's defaults, and why:
//   - the FACE: the engine's set is a combat one (angry, shout, grit). A keeper's is KFACE: neutral, smile, happy,
//     closed, oh, aww, shh, never angry (the dragons' DFACE rule, bible D18). The eye construction is the engine's
//     own (whites, a 3 x 2 pupil, 2 px brows), so a keeper's face is the sibling games' face with warmer expressions.
//   - the TORSO, HIPS and FEET: the engine's jacket (collar notch, chest seam, buttons), belt and buckle, and buckled
//     boots dress a soldier. A keeper wears a blouse and apron, a work shirt and braces, a cardigan, overalls, soft
//     shoes.
//   - the HAIR: the engine's cap, grown into a style per keeper (a bun, a crop under a hat, a bob, tufts), the head's
//     silhouette being what tells the keepers apart at the ÷ 3 size (cast.ts).
// Everything draws through rig.col(), so the engine's white flash and tint (DrawRigOpts) reach every keeper part.
import { rad } from '../../lib/engine/math.ts';
import { celPath, celPoly, celBall, celRect, tones } from '../../lib/art/shading.ts';
import { drawLimbSegs, brow } from '../../lib/art/rigParts.ts';
import { pathTaperedCapsule } from '../../lib/art/shapes.ts';
import { setLight } from '../../lib/art/rig.ts';
import type { Rig, RigAccessory, RigParts, RigWeapon } from '../../lib/art/rig.ts';
import type { Pose } from '../../lib/art/poses.ts';
import type { Info } from '../../lib/art/rigParts.ts';
import { drawBowl } from '../props.ts';
import { KEEPER_SHARED } from './palettes.ts';
import type { KeeperPalette } from './palettes.ts';
import type { KeeperRig } from './rig.ts';

const R = Math.round;
/** The keeper this rig was built for (a KeeperRig is a Rig: rig.ts buildKeeper). */
const K = (rig: Rig): KeeperRig => rig as KeeperRig;

// ---------- the face (KFACE) ----------

/**
 * The keepers' face set, stepped on `pose.face` (an index; the engine's FACE names do not apply to a keeper). Never
 * angry, the dragons' rule (bible D18): this is a cozy game, and the keepers' faces answer the dragons' --
 * `smile` is a keeper at work, `happy` and `aww` a dragon that is happy or asleep, `oh` a surprise (a sneeze, a
 * fizzle), `shh` the finger at the lips after a tuck-in, `closed` a keeper humming or content.
 */
export const KFACE = Object.freeze({ neutral: 0, smile: 1, happy: 2, closed: 3, oh: 4, aww: 5, shh: 6 });
export type KFaceName = keyof typeof KFACE;

/**
 * The face, head space (the head faces +x; the near eye at +0.45 r, the far one at -0.12 r, the engine's drawFace
 * geometry for a head under radius 9.5: whites 5 x 4 / 4 x 4, pupils 3 x 2, brows 2 px). The runtime blink
 * (KeeperRig.blink, player.ts) shuts open eyes to 2 px bars for its frames; the "^" eyes of happy and aww never blink.
 */
function drawKeeperFace(ctx: CanvasRenderingContext2D, rig: Rig, pose: Pose, info: Info): void {
  const k = K(rig), r = info.r, face = pose.face | 0, pal = k.kpal;
  const ink = k.col(k.outline), white = k.col(KEEPER_SHARED.white), pupil = k.col(KEEPER_SHARED.pupil);
  const ey = R(-r * 0.15), ex = R(r * 0.45), fx = R(-r * 0.12);
  const ew = 4, fw = 3, eh = 3, bt = 2;
  const arcs = face === KFACE.happy || face === KFACE.aww;
  const shut = !arcs && (face === KFACE.closed || face === KFACE.shh || k.blink > 0);
  const wide = face === KFACE.oh;
  // eyes
  if (arcs) {
    // the engine's happy "^": 1 px feet at both ends, the bar a row higher between them (2 px thick everywhere)
    ctx.fillStyle = ink;
    ctx.fillRect(ex - 1, ey, 1, bt); ctx.fillRect(ex, ey - 1, ew - 2, bt); ctx.fillRect(ex + ew - 2, ey, 1, bt);
    ctx.fillRect(fx - 1, ey, 1, bt); ctx.fillRect(fx, ey - 1, fw - 2, bt); ctx.fillRect(fx + fw - 2, ey, 1, bt);
  } else if (shut) {
    ctx.fillStyle = ink; ctx.fillRect(ex - 1, ey, ew, bt); ctx.fillRect(fx - 1, ey, fw, bt);
  } else {
    ctx.fillStyle = white; ctx.fillRect(ex - 1, ey - 1, ew + 1, eh + 1); ctx.fillRect(fx - 1, ey - 1, fw + 1, eh + 1);
    ctx.fillStyle = pupil;
    // the pupils sit in the MIDDLE rows of the whites and toward facing: in the engine's top rows every keeper looked
    // up and sideways, a bored side-eye (oh: they shrink to 2 x 2, the whites round them)
    if (wide) { ctx.fillRect(ex + 1, ey, 2, 2); ctx.fillRect(fx, ey, 2, 2); }
    else { ctx.fillRect(ex + 1, ey, 3, 2); ctx.fillRect(fx, ey, 3, 2); }
  }
  // brows, in the hair's colour (a grey-haired keeper's are grey), on the engine's row just over the whites; raised a
  // row for happy and oh, tilted up at the front for aww (the "aww" of a keeper watching a dragon doze: tender, not
  // worried). (A row higher they ran into the hairlines and the nightcap's cuff.)
  ctx.fillStyle = k.col(pal.hair);
  const by = ey - 3;
  if (face === KFACE.aww) { brow(ctx, ex - 2, by + 1, ex + ew - 2, by, bt); brow(ctx, fx - 1, by + 1, fx + fw - 1, by, bt); }
  else {
    const lift = face === KFACE.happy || wide ? 1 : 0;
    ctx.fillRect(ex - 2, by - lift, ew, bt); ctx.fillRect(fx - 1, by - lift, fw, bt);
  }
  // blush (flat, 3 x 2 under the near eye) on the warm faces
  if (arcs) { ctx.fillStyle = k.col(pal.glow); ctx.fillRect(ex - 1, ey + 3, 3, 2); }
  // mouth
  const mx = R(r * 0.45), my = R(r * 0.5) + 1;
  ctx.fillStyle = ink;
  if (face === KFACE.neutral) ctx.fillRect(mx, my, 3, 1);
  else if (wide) ctx.fillRect(mx, my - 1, 2, 3);
  else if (face === KFACE.shh) ctx.fillRect(mx + 1, my - 1, 2, 2);
  else if (face === KFACE.happy) {
    // an open smile: the corners up, a 3 x 2 mouth under the line
    ctx.fillRect(mx - 1, my - 1, 1, 1); ctx.fillRect(mx, my, 3, 1); ctx.fillRect(mx + 3, my - 1, 1, 1);
    ctx.fillRect(mx, my + 1, 3, 1); ctx.fillStyle = k.col('#a8404a'); ctx.fillRect(mx + 1, my + 1, 1, 1);
  } else { ctx.fillRect(mx - 1, my - 1, 1, 1); ctx.fillRect(mx, my, 3, 1); ctx.fillRect(mx + 3, my - 1, 1, 1); }
}

// ---------- the head ----------

/**
 * The skull (head space): the engine's drawSkull construction -- the cranium, the jaw, the ear and the nose bumps as
 * one path, stroked once and filled once -- with the face's shadow band at 0.2 of the head, not the engine's 0.3.
 * At 0.3 the band took the whole lower face, mouth to jaw, and even in the keepers' warm skin shadow it read as a
 * beard's shadow or a smudge (the dragons' heads made the same move, 0.34 -> 0.22: bible 1.2).
 */
function drawKeeperHead(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const r = info.r, jaw = 0.35, er = R(r * 0.26);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.05, r, r * 0.98, 0, Math.PI * 1.02, Math.PI * 2.02);
  ctx.lineTo(r * 0.98, r * jaw); ctx.lineTo(r * 0.6, r * 0.95); ctx.lineTo(-r * 0.55, r * 0.95); ctx.lineTo(-r * 0.98, r * jaw);
  ctx.closePath();
  ctx.moveTo(-r * 0.88 + er, r * 0.15); ctx.arc(-r * 0.88, r * 0.15, er, 0, Math.PI * 2);
  ctx.moveTo(r * 0.7, r * 0.05); ctx.lineTo(r * 1.15, r * 0.3); ctx.lineTo(r * 0.7, r * 0.45); ctx.closePath();
  celPath(ctx, K(rig), info.color, 0, 0, r, 0.2, 0.3);
}

// ---------- hair ----------

/** Append the hair's union path for the keeper's style (head space, r = head radius). */
function pathHair(ctx: CanvasRenderingContext2D, style: string, r: number): void {
  if (style === 'bun') {
    // a close cap that stands a pixel proud of the skull over the top and back, and the bun on the crown behind it
    ctx.moveTo(r * 0.6, -r * 0.72);
    ctx.ellipse(0, -r * 0.08, r * 1.07, r * 1.04, 0, -Math.PI * 0.27, -Math.PI * 1.08, true);
    ctx.lineTo(-r * 0.72, r * 0.2); ctx.lineTo(-r * 0.62, -r * 0.3); ctx.lineTo(-r * 0.2, -r * 0.62); ctx.lineTo(r * 0.25, -r * 0.66);
    ctx.closePath();
    ctx.moveTo(-r * 0.78 + r * 0.44, -r * 0.9);
    ctx.arc(-r * 0.78, -r * 0.9, r * 0.44, 0, Math.PI * 2);
    return;
  }
  if (style === 'cropped') {
    // short all round (the hat covers the top) and a sideburn down in front of the ear to meet the beard
    ctx.moveTo(r * 0.45, -r * 0.66);
    ctx.ellipse(0, -r * 0.06, r * 1.03, r * 1.0, 0, -Math.PI * 0.3, -Math.PI * 1.06, true);
    ctx.lineTo(-r * 0.78, r * 0.16); ctx.lineTo(-r * 0.5, r * 0.1); ctx.lineTo(-r * 0.5, r * 0.4); ctx.lineTo(-r * 0.24, r * 0.4);
    ctx.lineTo(-r * 0.26, -r * 0.3); ctx.lineTo(r * 0.1, -r * 0.62);
    ctx.closePath();
    return;
  }
  if (style === 'bob') {
    // a bob to the jaw at the back and a fringe that stops a row above the brow (the nightcap covers the crown)
    ctx.moveTo(r * 0.62, -r * 0.64);
    ctx.ellipse(0, -r * 0.06, r * 1.06, r * 1.02, 0, -Math.PI * 0.22, -Math.PI * 0.98, true);
    ctx.lineTo(-r * 1.14, r * 0.42); ctx.lineTo(-r * 0.98, r * 0.66); ctx.lineTo(-r * 0.56, r * 0.64);
    ctx.lineTo(-r * 0.42, r * 0.12); ctx.lineTo(-r * 0.3, -r * 0.44); ctx.lineTo(r * 0.2, -r * 0.66);
    ctx.closePath();
    return;
  }
  // tufts: the cap, and three tufts standing up off the crown (each >= 4 px at its root: the mark floor)
  ctx.moveTo(r * 0.62, -r * 0.62);
  ctx.ellipse(0, -r * 0.08, r * 1.05, r * 1.02, 0, -Math.PI * 0.24, -Math.PI * 1.04, true);
  ctx.lineTo(-r * 0.78, r * 0.12); ctx.lineTo(-r * 0.66, -r * 0.34); ctx.lineTo(-r * 0.25, -r * 0.62); ctx.lineTo(r * 0.2, -r * 0.62);
  ctx.closePath();
  const tuft = (x0: number, y0: number, tx: number, ty: number, x1: number, y1: number) => {
    ctx.moveTo(r * x0, r * y0); ctx.lineTo(r * tx, r * ty); ctx.lineTo(r * x1, r * y1); ctx.closePath();
  };
  tuft(0.52, -0.82, 0.62, -1.46, 0.02, -1.02);
  tuft(0.08, -1.04, -0.18, -1.66, -0.52, -0.98);
  tuft(-0.46, -0.94, -1.08, -1.36, -0.94, -0.52);
}

/** The hair (head space), one inked, cel-banded path per style. */
function drawKeeperHair(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = K(rig), r = info.r;
  ctx.beginPath();
  pathHair(ctx, k.spec.hair, r);
  celPath(ctx, k, info.color, -r * 0.25, -r * 0.55, r * 1.05, 0.4, 0.3);
}

// ---------- the beard ----------

/**
 * A short full beard along the jaw (Tomas): from the sideburn down the cheek, under the jaw line and a little proud
 * of the chin, its top edge a row under the mouth, so the mouth stays on skin and every face still reads.
 */
function drawKeeperBeard(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = K(rig), r = info.r;
  if (!k.spec.beard) return;
  ctx.beginPath();
  ctx.moveTo(-r * 0.44, -r * 0.2); ctx.lineTo(-r * 0.52, r * 0.42); ctx.lineTo(-r * 0.42, r * 1.02); ctx.lineTo(r * 0.3, r * 1.14);
  ctx.lineTo(r * 0.74, r * 1.0); ctx.lineTo(r * 0.86, r * 0.78); ctx.lineTo(r * 0.62, r * 0.8); ctx.lineTo(r * 0.2, r * 0.8);
  ctx.lineTo(-r * 0.08, r * 0.6); ctx.lineTo(-r * 0.2, r * 0.22); ctx.lineTo(-r * 0.22, -r * 0.2);
  ctx.closePath();
  celPath(ctx, k, info.color, 0, r * 0.5, r * 0.8, 0.4, 0);
}

// ---------- hats ----------

/** The nightcap's floppy cone: its chain (rig.ts builds it) and the rest bend of each segment, degrees clockwise from +x. */
export const CAP_SEGS = [{ len: 5, a: 205 }, { len: 5, a: 175 }, { len: 4.5, a: 140 }] as const;
const CAP_R = [4.5, 3.6, 2.7, 1.8];

/**
 * The hat, drawn last in the head group (head space): Tomas's wide straw hat (the crown and a brim 1.7 r either side,
 * with an oxblood band), Iris's nightcap (a beanie with a cream cuff whose cone flops back off the crown on a chain,
 * so it swings as she walks, and a pom-pom on its tip).
 */
function drawKeeperHat(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = K(rig), r = info.r, pal = k.kpal, hat = k.spec.hat;
  if (!hat || !pal.hat) return;
  if (hat === 'straw') {
    const by = -R(r * 0.8), cx0 = -R(r * 0.82), cx1 = R(r * 0.7), top = -R(r * 1.62);
    ctx.beginPath();
    // the crown, rounded on top, and the brim: one silhouette, stroked once
    ctx.moveTo(cx0, by); ctx.lineTo(cx0 + 1, top + 2); ctx.quadraticCurveTo(cx0 + 2, top, cx0 + 4, top);
    ctx.lineTo(cx1 - 4, top); ctx.quadraticCurveTo(cx1 - 1, top, cx1 - 1, top + 3); ctx.lineTo(cx1, by); ctx.closePath();
    const bx = -R(r * 0.05), brx = R(r * 1.75);
    ctx.moveTo(bx + brx, by); ctx.ellipse(bx, by, brx, 2, 0, 0, Math.PI * 2);
    celPath(ctx, k, pal.hat, 0, by - r * 0.3, r * 1.4, 0.34, 0.3);
    if (k.override) return;
    // the band: 2 px round the crown's foot, just over the brim's top row, inside the crown's ink
    ctx.fillStyle = k.col(pal.accent); ctx.fillRect(cx0 + 1, by - 4, cx1 - cx0 - 1, 2);
    return;
  }
  // the nightcap: the beanie over the crown and the cone off its back, one path
  const ch = k.chains.cap;
  ctx.beginPath();
  // (worn high at the front, its edge 2 rows over the brow, and low at the back over the bob: pulled down to the brow
  // it read as a bandage across the forehead)
  ctx.moveTo(r * 0.72, -r * 0.72);
  ctx.ellipse(0, -r * 0.12, r * 1.08, r * 1.02, 0, -Math.PI * 0.2, -Math.PI * 1.03, true);
  ctx.lineTo(-r * 0.92, -r * 0.18); ctx.lineTo(r * 0.66, -r * 0.72); ctx.closePath();
  // the cone: CAP_SEGS from the crown's back, each turned by the chain's angle on top of its rest bend
  let x = -r * 0.36, y = -r * 0.92, a = 0;
  for (let i = 0; i < CAP_SEGS.length; i++) {
    a = CAP_SEGS[i].a + (ch ? ch.total(i) : 0);
    const nx = x + Math.cos(rad(a)) * CAP_SEGS[i].len, ny = y + Math.sin(rad(a)) * CAP_SEGS[i].len;
    pathTaperedCapsule(ctx, x, y, nx, ny, CAP_R[i], CAP_R[i + 1], true);
    x = nx; y = ny;
  }
  celPath(ctx, k, pal.hat, -r * 0.4, -r * 0.8, r * 1.3, 0.36, 0.28);
  if (k.override) return;
  // the cuff: a 3 px band along the beanie's lower edge, inked (a turned-up fold: another layer of cloth)
  ctx.beginPath();
  ctx.moveTo(r * 0.86, -r * 0.72); ctx.lineTo(-r * 0.96, -r * 0.2); ctx.lineTo(-r * 1.0, -r * 0.2 - 3); ctx.lineTo(r * 0.8, -r * 0.72 - 3);
  ctx.closePath();
  celPath(ctx, k, pal.trim ?? pal.accent, 0, -r * 0.4, r, 0.4, 0);
  // the pom-pom on the tip
  celBall(ctx, k, x + Math.cos(rad(a)) * 1.5, y + Math.sin(rad(a)) * 1.5, 2.6, pal.trim ?? pal.accent, false);
}

// ---------- the torso, hips and feet ----------

/**
 * The top (torso space: the hip centre at the origin, y up negative, the front at +x). A blouse, shirt, cardigan or tee
 * as one cel-banded shape (Bea's barrel-shaped, the others the engine's wide-shouldered shield), then what goes over
 * it, each its own inked object: Bea's apron bib, Tomas's braces, Iris's open cardigan front (the nightshirt under it),
 * Pip's overall bib and strap.
 */
function drawKeeperTorso(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = K(rig), s = k.spec, pal = k.kpal, W = info.w ?? 22, H = info.h ?? 26;
  const hw = R(W / 2), hh = R((k.p.hip / 2) * 0.92), mid = R(-H * 0.5);
  const pts = s.age === 'elder'
    ? [-hw - 1, -H + 5, -hw + 4, -H, hw - 4, -H, hw + 1, -H + 5, hw + 1, mid, hh + 1, 2, -hh - 1, 2, -hw, mid]
    : [-hw - 1, -H + 4, -hw + 4, -H, hw - 4, -H, hw + 1, -H + 4, hw, mid, hh, 2, -hh, 2, -hw, mid];
  celPoly(ctx, k, pts, pal.primary, 0.36, 0.28);
  if (k.override) return;
  if (s.apron && pal.apron) {
    celPoly(ctx, k, [2, -H + 7, hw + 1, -H + 6, hw + 1, mid, hh + 1, 2, 2, 2], pal.apron, 0.3, 0);
  }
  if (s.over === 'braces') {
    // one brace (the near one), 3 px, from the waist at the front up over the shoulder
    celPoly(ctx, k, [R(hw * 0.35), 2, R(hw * 0.35) + 3, 2, R(-hw * 0.05) + 3, -H, R(-hw * 0.05), -H], pal.accent, 0.3, 0);
  }
  if (s.over === 'cardigan' && pal.trim) {
    // the open front: the cream nightshirt between the cardigan's edges
    celPoly(ctx, k, [hw - 5, -H + 1, hw + 1, -H + 4, hw, mid, hh, 2, hh - 5, 2, hw - 5, mid], pal.trim, 0.3, 0);
  }
  if (s.over === 'overalls') {
    const top = R(-H * 0.58);
    celPoly(ctx, k, [-1, top, hw, top, hw, mid, hh, 2, -hh + 2, 2], pal.secondary, 0.3, 0);
    // the strap over the shoulder, and its buckle
    celPoly(ctx, k, [-1, top, 2, top, 0, -H, -3, -H], pal.trim ?? pal.secondary, 0.3, 0);
    ctx.fillStyle = k.col(pal.accent); ctx.fillRect(-1, top, 2, 2);
  }
}

/**
 * The hips (hip space: the origin on the hip line at the body's centre). Trousers: the engine's block without its belt
 * and buckle. Bea: a skirt whose hem follows her knees (so a stride pushes it out) and the apron's skirt over its front.
 */
function drawKeeperHips(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = K(rig), s = k.spec, pal = k.kpal, hip = info.w ?? 18, hw = R(hip / 2);
  if (!s.apron) { celRect(ctx, k, -hw, -5, hip, 10, 3, pal.secondary, 0.4, 0.2); return; }
  const J = k.joints, y0 = k.joints.hipN.y;
  const front = Math.max(J.kneeN.x, J.kneeF.x, hw) + 3, back = Math.min(J.kneeN.x, J.kneeF.x, -hw) - 2;
  const hem = Math.max(J.kneeN.y, J.kneeF.y) - y0 - 1;
  celPoly(ctx, k, [-hw - 1, -5, hw + 1, -5, front, hem, back, hem], pal.secondary, 0.36, 0.2);
  if (k.override || !pal.apron) return;
  celPoly(ctx, k, [1, -5, hw + 1, -5, front, hem - 2, R((front + 1) * 0.45), hem - 2], pal.apron, 0.3, 0);
}

/** A soft shoe (ankle space: +x toward the toe, y down): a rounded toe, the sole's bottom on the floor row. */
function drawKeeperShoe(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = K(rig), L = info.w ?? 10, H = info.h ?? 5, hex = info.color;
  const heel = R(L * 0.4), toe = R(L * 0.6), top = -R(H * 0.9), sole = H - 2;
  celPoly(ctx, k, [-heel, top + 1, -heel + 1, top, R(heel * 0.2), top, toe - 3, sole - 3, toe - 1, sole - 3, toe, sole - 1, toe, sole, -heel, sole], hex, 0.34, 0.3);
  if (k.override) return;
  ctx.fillStyle = tones(k, hex).deep; ctx.fillRect(-heel, sole - 1, heel + toe, 1);
}

/**
 * A long sleeve (Iris's cardigan): the whole arm drawn from the shoulder as ONE tube in the sleeve colour, the engine's
 * drawLimbSegs construction with both materials the same, so no seam crosses the elbow; the forearm hook draws nothing.
 * Limb space: +y down the upper arm; the forearm turns by the pose's relative `lower`.
 */
function drawLongSleeve(ctx: CanvasRenderingContext2D, rig: Rig, pose: Pose, info: Info): void {
  const p = rig.p, rel = info.far ? pose.armL.lower : pose.armR.lower, L1 = p.upperArm, L2 = p.lowerArm;
  const a = { x: 0, y: p.armR * 0.45 }, b = { x: 0, y: L1 }, c = { x: Math.sin(rad(rel)) * L2, y: L1 + Math.cos(rad(rel)) * L2 };
  drawLimbSegs(ctx, rig, a, b, c, p.armR, p.armR + 0.5, info.color, info.color, true, p.bulge);
}
function noop(): void { /* drawn by drawLongSleeve */ }

// ---------- what a keeper holds ----------

/** The bowl a keeper carries (KeeperRig.bowl): its size is the one the dragon it is for eats from (props.ts bowlFor). */
export interface HeldBowl { w: number; h: number; full: boolean }

/**
 * Where a carried bowl sits on the near hand (hand space, level): its centre BOWL_AHEAD px ahead of the hand's centre
 * and its rim's ink row BOWL_UNDER px under it, so the fingers show over the rim. A set-down puts the hand at
 * (bowl x - BOWL_AHEAD, floor - h - BOWL_UNDER - 1) and the bowl's foot lands on the floor row.
 */
export const BOWL_AHEAD = 3, BOWL_UNDER = 1;

/**
 * The bowl in the hands, drawn level whatever the forearm's angle, as a FRONT accessory on the near hand: in front of
 * both fists, which grip its rim from behind. (In the weapon slot the near fist, drawn after the weapon, hid two
 * thirds of a 15 px bowl.) The weapon slot keeps an invisible two-handed grip (TOOL_BOWL), so the far arm still
 * reaches for the bowl by the engine's own IK. The same whole-pixel bowl the dragon eats from (props.ts drawBowl).
 */
function drawHeldBowl(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose): void {
  const k = K(rig), b = k.bowl;
  if (!b || k.override) return;
  const a = -rig.joints.armN.hand + 90;
  ctx.save(); ctx.rotate(rad(-a)); setLight(k, 0);
  drawBowl(ctx, BOWL_AHEAD, BOWL_UNDER + b.h + 1, b.w, b.h, 1, b.full);
  ctx.restore();
}
/** The held bowl's accessory entry (every keeper has it; it draws only while KeeperRig.bowl is set). */
export const HELD_BOWL: RigAccessory = Object.freeze({ attach: 'handR', layer: 'front', draw: drawHeldBowl });

/** How far under the near hand's centre a held brush's bristles reach, px: a groom's reach target sits this far up. */
export const BRUSH_DROP = 8;

/**
 * Tomas's grooming brush, held by its back in the near fist with its bristles DOWN whatever the forearm does (drawn
 * level, under the fist, which closes over its back): an oval wooden back and a pale bristle band under it. Hanging at
 * his side it is a brush carried by its back; grooming, the bristles lie on the dragon's scales under his hand, so the
 * groom's reach target is BRUSH_DROP over the scales. (Out of the fist along the forearm, a handle and a block read as
 * a knife, and a T-head as a toilet brush poking the dragon.)
 */
function drawHeldBrush(ctx: CanvasRenderingContext2D, rig: Rig, pose: Pose): void {
  const k = K(rig), pal = k.kpal, wood = pal.tool ?? pal.accent;
  const a = -rig.joints.armN.hand + 90 + pose.weapon.rot;
  ctx.save(); ctx.rotate(rad(-a)); setLight(k, 0);
  celRect(ctx, k, -5, 1, 11, 5, 2, wood, 0.4, 0);
  celRect(ctx, k, -4, 5, 9, 3, 1, '#e9dcc0', 0.3, 0);
  ctx.restore();
}

/**
 * The weapon-slot entries for the tools (rig.weapon is swapped as a keeper picks a thing up and puts it down). The
 * bowl's is an invisible two-handed grip (the bowl itself is HELD_BOWL, drawn in front of the hands).
 */
export const TOOL_BOWL: RigWeapon = Object.freeze({ attach: 'handR', length: 10, twoHanded: true, grip: 2, draw: noop });
export const TOOL_BRUSH: RigWeapon = Object.freeze({ attach: 'handR', length: 14, draw: drawHeldBrush });

/** A keeper's part table for buildRig: the engine's defaults kept for the limbs, the hands and the skull. */
export function keeperParts(sleeves: 'long' | 'short'): RigParts {
  const parts: RigParts = {
    head: drawKeeperHead, face: drawKeeperFace, hair: drawKeeperHair, beard: drawKeeperBeard, hat: drawKeeperHat,
    torso: drawKeeperTorso, hips: drawKeeperHips, foot: drawKeeperShoe,
  };
  if (sleeves === 'long') { parts.armUpper = drawLongSleeve; parts.armLower = noop; }
  return parts;
}
