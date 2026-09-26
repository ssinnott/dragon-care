// The mission art's seam (plan S9a): the signatures the art kit exports, drawn here as plain greybox stand-ins so the
// mission screens (S8) and the scene (S9) can be built before the art lands. At the merge this file becomes
// re-exports of backdrops.ts, setpieces.ts, baddies.ts, npcs.ts and missionicons.ts; callers import from here only.
import type { DayPhase } from './clock.ts';
import type { Rect, Sprite } from './icons.ts';
import type { Climate, ChallengeId, Skill, BaddieId, BaddieFace, BaddiePose, MillerMood, StopState } from './missiondata.ts';
import { drawText } from '../lib/engine/text.ts';

const INK = '#1a1018';
const box = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, label: string) => {
  ctx.fillStyle = INK; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.fillStyle = fill; ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
  drawText(ctx, label, Math.round(x) + 3, Math.round(y) + 3, { color: INK, shadow: false });
};
const CLIMATE_FILL: Readonly<Record<Climate, string>> = { meadow: '#b3cfae', caves: '#c8b48e', forest: '#7f9e6c', peaks: '#a8b0c0', ice: '#d8e4ec', ash: '#c8a898' };

/** The region's picture in stepped flat layers (S9a: backdrops.ts). `scroll` advances the parallax for the road scene. */
export function drawClimate(ctx: CanvasRenderingContext2D, climate: Climate, phase: DayPhase, rect: Rect, scroll = 0): void {
  void scroll;
  box(ctx, rect.x, rect.y, rect.w, rect.h, phase === 'night' ? '#6f7fa8' : CLIMATE_FILL[climate], `${climate.toUpperCase()} (${phase.toUpperCase()})`);
}
/** A challenge's set piece on the road (S9a: setpieces.ts). */
export function drawSetPiece(ctx: CanvasRenderingContext2D, id: ChallengeId, x: number, feetY: number, state: StopState, t: number): void {
  void t;
  box(ctx, x - 24, feetY - 40, 48, 40, state === 'met' ? '#d6e8c8' : state === 'unmet' ? '#f0d0c0' : '#e8d8a8', id.toUpperCase());
}
/** A big baddie (S9a: baddies.ts): ~96-140 px, faces only from BaddieFace, poses from BaddiePose. */
export function drawBaddie(ctx: CanvasRenderingContext2D, id: BaddieId, x: number, feetY: number, facing: 1 | -1, face: BaddieFace, pose: BaddiePose, t: number): void {
  void facing; void t;
  box(ctx, x - 50, feetY - 100, 100, 100, '#8a7060', `${id.toUpperCase()} ${face.toUpperCase()} ${pose.toUpperCase()}`);
}
/** A baddie's 24 x 24 portrait for the chooser (S9a: baddies.ts). */
export function drawBaddiePortrait(ctx: CanvasRenderingContext2D, id: BaddieId, x: number, y: number): void {
  box(ctx, x, y, 24, 24, '#8a7060', id.slice(0, 1).toUpperCase());
}
/** The grumpy miller, a person on the keeper rig (S9a: npcs.ts). */
export function drawMiller(ctx: CanvasRenderingContext2D, mood: MillerMood, x: number, feetY: number, facing: 1 | -1, t: number): void {
  void facing; void t;
  box(ctx, x - 12, feetY - 76, 24, 76, mood === 'grumpy' ? '#b0a0a0' : '#e0d0b0', 'M');
}
const ICON = (c: string): Sprite => ({ rows: ['kkkkkkkkk', ...Array.from({ length: 7 }, () => 'kccccccck'), 'kkkkkkkkk'], colors: { k: INK, c } });
/** 9 x 9 challenge and skill icons, and the saddle (S9a: missionicons.ts). */
export const CHALLENGE_ICONS: Readonly<Record<ChallengeId, Sprite>> = {
  dark: ICON('#2a2440'), heavy: ICON('#a08060'), cold: ICON('#d8e4ec'), storm: ICON('#e8c040'), flood: ICON('#4aa8d8'), thorns: ICON('#6a9a4a'),
  lost: ICON('#b09070'), miller: ICON('#e0d6b8'), hurt: ICON('#e08080'), fog: ICON('#c0c4c8'), gap: ICON('#8a8a94'),
};
export const SKILL_ICONS: Readonly<Record<Skill, Sprite>> = { charm: ICON('#e06080'), medic: ICON('#f0f0f0'), navigator: ICON('#4a78c0'), nimble: ICON('#60c060') };
export const SADDLE: Sprite = ICON('#8a5a34');
