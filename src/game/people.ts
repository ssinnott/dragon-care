// The base's people: the real named cast (docs/KEEPERS.md), the same rig, palettes and baked anims the yard uses
// (src/art/keeper/, src/care/keeper.ts), driven here by the care simulation's own walking and job state (sim.ts)
// instead of the yard's director. `stepKeeperVisual` picks the anim the sim's phase and job call for and steps the
// agent with its position pinned (KeeperAgent.pinX): sim.ts already walks a keeper along the barn's routes, so the
// anim plays in place and never carries them by its own root motion. What the yard's care acts add beyond this --
// eye-safe standing spots and marks, planned per act (docs/KEEPERS.md 6.3) -- stays theirs; here a keeper just does
// the anim closest to its job while it stands where sim.ts put it.
import { makeKeeper, stepKeeperAgent, drawKeeperAgent } from '../care/keeper.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { keeperJoint } from '../art/keeper/rig.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import { ICONS, drawSprite } from './icons.ts';
import type { Sprite } from './icons.ts';
import type { Keeper } from './sim.ts';
import type { NeedKind } from './needs.ts';

/** Build a keeper's character once (the cast's own proportions, palette and anim set: art/keeper/cast.ts). */
export function makeKeeperAgent(id: KeeperId): KeeperAgent {
  return makeKeeper(id, 'idle', 0, 0);
}

/** What a keeper carries to a job, in the near hand (the yard's acts carry the real bowl prop; the base, its icon). */
const BUCKET: Sprite = { rows: ['kkkkkkk', 'kbbbbbk', '.ggggg.', '.ggggg.', '..ggg..'], colors: { k: '#5a5460', b: '#4aa8d8', g: '#8c8a94' } };
const CARRIED: Readonly<Partial<Record<NeedKind, Sprite>>> = { food: ICONS.food, play: ICONS.play, bath: BUCKET };

/**
 * The cast's anim closest to what a keeper is doing (docs/KEEPERS.md 5's vocabulary): walking to or from a job,
 * carrying its supply; fetching one (`hold`, standing with it); at work, `watch` for a feed (the bowl is down, she
 * watches the dragon eat), `kneelIdle` for a tuck-in, and `pet` for love, play or a bath alike -- the named cast has
 * no anim of its own for those last two, so the same fond stroke stands in for them here.
 */
function animFor(k: Keeper): string {
  if (k.climbing) return 'idle';
  if (k.phase === 'pickup') return 'hold';
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

/** Advance a keeper's character one tick: the anim the sim's state calls for, stepped at the spot sim.ts walked it to. */
export function stepKeeperVisual(agent: KeeperAgent, k: Keeper, y: number): void {
  agent.x = k.x; agent.y = y; agent.facing = k.facing; agent.pinX = true;
  agent.player.play(animFor(k), { blend: 8 });
  stepKeeperAgent(agent);
}

const PT = { x: 0, y: 0 };

/** Draw a keeper (already stepped this tick): what they carry, and the rush mark over their head while running. */
export function drawKeeperVisual(ctx: CanvasRenderingContext2D, agent: KeeperAgent, k: Keeper): void {
  drawKeeperAgent(ctx, agent);
  const item = k.carrying ? CARRIED[k.carrying] : undefined;
  if (item) { keeperJoint(agent.rig, 'handN', PT); drawSprite(ctx, item, PT.x + k.facing * 3, PT.y - 2); }
  if (k.rushing) { keeperJoint(agent.rig, 'head', PT); drawSprite(ctx, ICONS.rush, PT.x, PT.y - 17); }
}
