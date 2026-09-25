// The base's people on the engine's paper-doll rig (src/lib/art/rig.ts, about 72 to 76 px at scale 1): the keepers'
// looks, a pose for everything the care simulation has them do, and what they carry. No human walk is authored in
// this repo yet (docs/BASE_DESIGN.md 6 lists it as new work), so the walk and the climb here are procedural.
import { buildRig, drawRig, jointScreen } from '../lib/art/rig.ts';
import type { Rig } from '../lib/art/rig.ts';
import type { Palette } from '../lib/art/palettes.ts';
import type { PartialPose } from '../lib/art/poses.ts';
import { FACE } from '../lib/art/poses.ts';
import { ICONS, drawSprite } from './icons.ts';
import type { Sprite } from './icons.ts';
import type { Keeper } from './sim.ts';
import type { NeedKind } from './needs.ts';

const BASE: Palette = { skin: '#e0ac88', hair: '#4a3020', primary: '#5a7a9a', secondary: '#4a4a5a', accent: '#c8a050', metal: '#b0b0b8', dark: '#3a2a2a', glow: '#ffd080' };
/** The keepers' looks (start.ts names them): an apron for the cook, a smock for the groomer, the handler's riding coat. */
export const LOOKS: Readonly<Record<string, Partial<Palette>>> = Object.freeze({
  cook: { skin: '#e0ac88', hair: '#4a3020', primary: '#f0ead8', secondary: '#5a4a3a', sleeve: '#b85a44' },
  groom: { skin: '#a86a48', hair: '#2a1a14', primary: '#5a7a9a', secondary: '#3e4a3a' },
  handler: { skin: '#f0c8a8', hair: '#c87838', primary: '#7a4a6a', secondary: '#4a4a5a', sleeve: '#5a3a50' },
  hand: { skin: '#6a4430', hair: '#1a1010', primary: '#6a8a5a', secondary: '#5a4a3a' },
  hand2: { skin: '#c89070', hair: '#3a2a1a', primary: '#4a6a7a', secondary: '#6a5a4a' },
});
export function keeperRig(look: string): Rig { return buildRig({ basePalette: BASE, palette: LOOKS[look] ?? {} }); }

/** What a keeper carries to a job, in the near hand. */
const BUCKET: Sprite = { rows: ['kkkkkkk', 'kbbbbbk', '.ggggg.', '.ggggg.', '..ggg..'], colors: { k: '#5a5460', b: '#4aa8d8', g: '#8c8a94' } };
const CARRIED: Readonly<Partial<Record<NeedKind, Sprite>>> = { food: ICONS.food, play: ICONS.play, bath: BUCKET };

/** A step of the walk: legs swing about the hip and the back knee bends; the arms swing opposite, or hold a load out. */
function stride(ph: number, carrying: boolean): PartialPose {
  const s = Math.sin(ph), A = 20;
  return {
    face: FACE.happy,
    legR: { upper: A * s, lower: A * s - 8 - 10 * Math.max(0, -s) }, legL: { upper: -A * s, lower: -A * s - 8 - 10 * Math.max(0, s) },
    armR: carrying ? { upper: 30, lower: 58 } : { upper: -16 * s, lower: 12 }, armL: carrying ? { upper: 26, lower: 60 } : { upper: 16 * s, lower: 12 },
    root: { y: -Math.abs(Math.cos(ph)) },
  };
}

/** The pose for what a keeper is doing this frame; `clock` (60 Hz frames) drives the working motions. */
export function keeperPose(k: Keeper, clock: number): PartialPose {
  if (k.climbing) {
    // hand over hand: the arms reach up by turns and the knees lift with them
    const s = Math.sin(k.y / 9);
    return { face: FACE.neutral, armR: { upper: 160 + 14 * s, lower: 12 }, armL: { upper: 160 - 14 * s, lower: 12 },
      legR: { upper: 28 + 18 * s, lower: -26 }, legL: { upper: 28 - 18 * s, lower: -26 } };
  }
  if (k.legs.length && (k.phase === 'fetch' || k.phase === 'go' || k.phase === 'home')) return stride(k.walked / 7, !!k.carrying);
  const w = clock / 10;
  switch (k.phase) {
    case 'pickup': return { face: FACE.happy, torso: { rot: 14 }, armR: { upper: 48, lower: 24 }, armL: { upper: 40, lower: 24 } };
    case 'work':
      switch (k.job?.need) {
        case 'food': return { face: FACE.happy, torso: { rot: 16 }, armR: { upper: 46, lower: 26 }, armL: { upper: 38, lower: 26 } };
        case 'love': return { face: FACE.happy, armR: { upper: 74 + 6 * Math.sin(w), lower: 14 }, armL: { upper: 10, lower: 12 } };
        case 'play': return { face: FACE.happy, armR: { upper: 70 + 70 * (0.5 + 0.5 * Math.sin(w * 0.8)), lower: 18 }, armL: { upper: -10, lower: 12 } };
        case 'bath': return { face: FACE.happy, torso: { rot: 8 }, armR: { upper: 70 + 10 * Math.sin(w * 2), lower: 30 }, armL: { upper: 58, lower: 30 } };
        case 'sleep': return { face: FACE.happy, torso: { rot: 18 }, armR: { upper: 56, lower: 16 }, armL: { upper: 50, lower: 16 } };
        default: return { face: FACE.happy };
      }
    default: return { face: FACE.happy };
  }
}

/** Draw a keeper with their feet at y, what they carry in the near hand, and the rush mark over their head while running. */
export function drawKeeper(ctx: CanvasRenderingContext2D, rig: Rig, k: Keeper, y: number, clock: number): void {
  drawRig(ctx, rig, keeperPose(k, clock), { x: Math.round(k.x), y: Math.round(y), facing: k.facing, still: true });
  const item = k.carrying ? CARRIED[k.carrying] : undefined;
  if (item) { const h = jointScreen(rig, 'handN'); drawSprite(ctx, item, h.x + k.facing * 3, h.y - 2); }
  if (k.rushing) { const hd = jointScreen(rig, 'head'); drawSprite(ctx, ICONS.rush, hd.x, hd.y - 17); }
}
