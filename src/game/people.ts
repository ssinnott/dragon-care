// The base's people: the real named cast (docs/KEEPERS.md), the same rig, palettes and baked anims the yard uses
// (src/art/keeper/, src/care/keeper.ts), driven here by the care simulation's own walking and job state (sim.ts)
// instead of the yard's director. `stepKeeperVisual` picks the anim the sim's phase and job call for and steps the
// agent with its position pinned (KeeperAgent.pinX): sim.ts already walks a keeper along the barn's routes, so the
// anim plays in place and never carries them by its own root motion -- but a walk plays at the pace sim.ts walks them
// (its `move` is the look's own speed: KEEPERS[look].speed), so the feet keep to the floor. What the yard's care acts add beyond this --
// eye-safe standing spots and marks, planned per act (docs/KEEPERS.md 6.3) -- stays theirs; here a keeper just does
// the anim closest to its job while it stands where sim.ts put it.
import { makeKeeper, stepKeeperAgent, drawKeeperAgent } from '../care/keeper.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { keeperJoint } from '../art/keeper/rig.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import { ICONS, drawSprite } from './icons.ts';
import type { Sprite } from './icons.ts';
import type { Keeper } from './sim.ts';
import { WALK, RUSH } from './sim.ts';
import type { NeedKind } from './needs.ts';
import { KEEPERS } from '../art/keeper/cast.ts';
import { KEEPER_PALETTES } from '../art/keeper/palettes.ts';

/** Build a keeper's character once (the cast's own proportions, palette and anim set: art/keeper/cast.ts). */
export function makeKeeperAgent(id: KeeperId): KeeperAgent {
  return makeKeeper(id, 'idle', 0, 0);
}

/** What a keeper carries to a job, in the near hand (the yard's acts carry the real bowl prop; the base, its icon). */
const BUCKET: Sprite = { rows: ['kkkkkkk', 'kbbbbbk', '.ggggg.', '.ggggg.', '..ggg..'], colors: { k: '#5a5460', b: '#4aa8d8', g: '#8c8a94' } };
const CARRIED: Readonly<Partial<Record<NeedKind, Sprite>>> = { food: ICONS.food, play: ICONS.play, bath: BUCKET };

/**
 * The cast's anim closest to what a keeper is doing (docs/KEEPERS.md 5's vocabulary): walking to or from a job,
 * carrying its supply; fetching one (`hold`, standing with it); at the stand spot before the dragon, `watch` (waiting
 * for it to walk in); held at the lift bay's edge, `idle`; at work, `watch` for a feed (the bowl is down, she watches
 * the dragon eat), `kneelIdle` for a tuck-in, and `pet` for love, play or a bath alike -- the named cast has no anim of
 * its own for those last two, so the same fond stroke stands in for them here. Held by the player's hand (plan S7):
 * walking (or carrying) while they moved this step, else `idle`; `hold` picking a supply up; a climb is `idle`, as
 * any keeper's (the cast has no climb anim: a stand-in).
 */
function animFor(k: Keeper, moved: boolean): string {
  if (k.climbing) return 'idle';
  if (k.phase === 'manual') return moved ? (k.carrying ? 'carry' : 'walk') : 'idle';
  if (k.phase === 'pickup') return 'hold';
  if (k.phase === 'wait') return 'watch';
  if (k.bayWait > 0) return 'idle';
  if (k.phase === 'fetch' || k.phase === 'go' || k.phase === 'home') return k.carrying ? 'carry' : 'walk';
  if (k.phase === 'work') {
    switch (k.job?.need) {
      case 'food': return 'watch';
      case 'sleep': return 'kneelIdle';
      default: return 'pet';
    }
  }
  return 'idle';
}

/**
 * Advance a keeper's character one tick: the anim the sim's state calls for, stepped at the spot sim.ts walked it to.
 * A walk or carry plays at pace / the look's own walk speed (pace 1, or RUSH while rushing), so its planted foot moves
 * with the floor exactly as fast as sim.ts moves the keeper.
 */
export function stepKeeperVisual(agent: KeeperAgent, k: Keeper, y: number, moved = false): void {
  agent.x = k.x; agent.y = y; agent.facing = k.facing; agent.pinX = true;
  const anim = animFor(k, moved);
  agent.player.play(anim, { blend: 8 });
  if (anim === 'walk' || anim === 'carry') agent.player.setSpeed((k.rushing ? RUSH : 1) * WALK / KEEPERS[k.look].speed);
  stepKeeperAgent(agent);
}

const PT = { x: 0, y: 0 };

/**
 * The mark over the keeper held by hand (plan S7): a 7 x 5 inked arrow pointing down at them, in their own top colour,
 * where the rush mark goes (a keeper held by hand is never rushed, so the place is free). And the "?" a keeper shows a
 * moment when E did nothing, 7 x 9, over it.
 */
const MARKS = new Map<KeeperId, Sprite>();
function markOf(look: KeeperId): Sprite {
  let m = MARKS.get(look);
  if (!m) { m = { rows: ['ppppppp', 'ppppppp', '.ppppp.', '..ppp..', '...p...'], colors: { p: KEEPER_PALETTES[look].primary } }; MARKS.set(look, m); }
  return m;
}
const ASK: Sprite = { rows: ['.wwwww.', 'ww...ww', 'ww...ww', '....ww.', '...ww..', '...ww..', '.......', '...ww..', '...ww..'], colors: { w: '#f3e6c8' } };

/** Draw a keeper (already stepped this tick): what they carry, the rush mark over their head while running, or the hand's mark and its "?". */
export function drawKeeperVisual(ctx: CanvasRenderingContext2D, agent: KeeperAgent, k: Keeper): void {
  drawKeeperAgent(ctx, agent);
  const item = k.carrying ? CARRIED[k.carrying] : undefined;
  if (item) { keeperJoint(agent.rig, 'handN', PT); drawSprite(ctx, item, PT.x + k.facing * 3, PT.y - 2); }
  if (k.rushing) { keeperJoint(agent.rig, 'head', PT); drawSprite(ctx, ICONS.rush, PT.x, PT.y - 17); }
  if (k.manual || k.pendingTake) {
    keeperJoint(agent.rig, 'head', PT);
    drawSprite(ctx, markOf(k.look), PT.x, PT.y - 17);
    if (k.cue > 0) drawSprite(ctx, ASK, PT.x, PT.y - 30);
  }
}
