// The road's people who are not keepers (plan S9a; S9 draws them at their stop): THE GRUMPY MILLER ("Hob"), met at the
// mill on a `miller` stop, grumpy until a CHARM rider (Bea) talks him round. He is drawn through the keepers' own rig
// (src/art/keeper: cast.ts NPCS.miller, palettes.ts KEEPER_PALETTES.miller, parts.ts's flat cap, rim of hair, bushy
// brows, moustache, rolled sleeves, flour sack and the `grumpy` / `glad` faces, anims.ts millerAnims), but he is NOT a
// keeper: he is in NPC_IDS, never in KEEPER_IDS (which drives the four keepers everywhere: the sim, saves, the HUD and
// every keeper loop), has no job and no agent, and only this file draws him.
//
// Who he is, at a glance: an older, stocky man -- never frail: no stoop, no cane, no tremor (the elders' rule) -- in a
// flat cap whose stiff peak juts out over his brow, iron-grey hair round the back, bushy grey brows and moustache on a
// ruddy face, a cream shirt with the sleeves rolled, a dark canvas apron dusted with flour over slate trousers, and his
// hessian flour sack set down at his feet. At a third of his size the flat-topped wedge of the cap and the sack tell
// him from Bea (a bun), Tomas (a wide brim), Iris (a floppy cap) and Pip (tufts).
//
//   grumpy       READS GRUMPY AT 1X, within the no-V-brow rule: turned away from whoever talks to him, arms folded
//                high across his chest (both fists tucked), weight back on his heels, chin tucked; the bushy brows
//                FLAT and pressed down onto half-lidded eyes that side-eye back at them, a pout under a drooping
//                walrus moustache, and a small "hmph" puff snorted from his nose;
//   talkedRound  turned to face them: brows up, smiling eyes, a blush and a small smile under the moustache's lifted
//                ends, a little nod, tipping his cap at its peak with his near hand (the elbow out in front, so the
//                forearm passes clear of his eyes and his smile; the cap follows the hand).
// Nobody is angry and nobody is hurt: grumpy is a mood, and it is talked round.
import { buildKeeper, stepKeeper, drawKeeper } from '../art/keeper/rig.ts';
import type { KeeperRig } from '../art/keeper/rig.ts';
import { KeeperPlayer } from '../art/keeper/player.ts';
import { millerAnims } from '../art/keeper/anims.ts';
import { drawSack, SACK } from '../art/keeper/parts.ts';
import { KEEPER_SHARED } from '../art/keeper/palettes.ts';
import type { MillerMood } from './missiondata.ts';

/** Each mood's anim in millerAnims (a 180 f loop: a slow breath). */
const ANIM: Readonly<Record<MillerMood, string>> = Object.freeze({ grumpy: 'grumpy', talkedRound: 'talked' });
/** Where his sack stands, px in front of his feet along the way he faces: grumpy, on his own side; talked round, set down toward them. */
const SACK_AT: Readonly<Record<MillerMood, number>> = Object.freeze({ grumpy: 24, talkedRound: 26 });

let RIG: KeeperRig | null = null;
let PLAYER: KeeperPlayer | null = null;
/** His rig and player, built once (blinks off: every frame is a pure function of the mood and t). */
function miller(): { k: KeeperRig; player: KeeperPlayer } {
  if (!RIG || !PLAYER) {
    RIG = buildKeeper('miller');
    PLAYER = new KeeperPlayer(millerAnims(RIG.spec), 1);
    PLAYER.blinks = false;
  }
  return { k: RIG, player: PLAYER };
}

/**
 * Draw the grumpy miller standing on the road at (x, feetY) (the floor point between his feet, screen px), his flour
 * sack at his feet. `facing` is the side he is talked to from (the team): grumpy, he stands turned away from it, arms
 * folded, glancing back; talked round, he faces it and tips his cap. `t` is the scene's step (his breath). Every pixel
 * is a pure function of (mood, x, feetY, facing, t). `silhouette`: every part flat in that colour (the gallery's
 * silhouette sheet).
 */
export function drawMiller(ctx: CanvasRenderingContext2D, mood: MillerMood, x: number, feetY: number, facing: 1 | -1, t: number, silhouette: string | null = null): void {
  const { k, player } = miller(), grumpy = mood === 'grumpy';
  const f = (grumpy ? -facing : facing) as 1 | -1;
  player.play(ANIM[mood], { restart: true });
  const n = ((Math.floor(t) % player.length) + player.length) % player.length;
  for (let i = 0; i < n; i++) player.tick();
  k.sack = false; k.fold = grumpy;
  const o = { x: Math.round(x), y: Math.round(feetY), facing: f, scale: 1 };
  stepKeeper(k, player.pose, o);
  // the sack on the road first (he never stands behind it: it is set down in front of him, clear of his feet)
  const sx = o.x + f * SACK_AT[mood];
  if (!silhouette) {
    ctx.fillStyle = KEEPER_SHARED.groundShadow;
    ctx.beginPath(); ctx.ellipse(sx, o.y, 9, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  k.override = silhouette;
  drawSack(ctx, k, sx, o.y, SACK.w, SACK.h);
  k.override = null;
  drawKeeper(ctx, k, player.pose, { ...o, shadow: !silhouette, silhouette });
}
