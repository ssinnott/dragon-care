// view=missionart (src/gallery.ts): the mission art kit laid out on sheets (plan S9a), frozen-time safe -- every
// drawing is a pure function of the sheet's own step counter, so `t=` draws the same frame every time.
//
//   view=missionart&sheet=climates     the six climates at day, dusk, night and dawn, each at the chooser's 300 x 112
//   view=missionart&sheet=climates&climate=<c>&phase=<p>
//                                      one climate filling a 640 x 300 road scene, scrolling with t (S9's parallax),
//                                      the road band (FLOORS.road) at y 292-306
//   view=missionart&sheet=setpieces    the eleven set pieces on the road, ahead and met side by side (an adult dragon
//                                      standing in the fog, which is drawn behind it)
//   view=missionart&sheet=baddies      the three big baddies: every face, every pose and each exit, an adult dragon for
//                                      scale, and their 24 x 24 portraits (&id=<baddie>: that one's row alone)
//   view=missionart&sheet=people       the grumpy miller, grumpy and talked round, at 1x and 3x, beside the four keepers,
//                                      and all five as flat silhouettes at a third of their size
//   view=missionart&sheet=icons        the challenge and skill icons, the saddle and the carried eggs, at 1x and 3x
//
// The page's hook (window.__dragonCare.missionart) names the sheet and what it drew, for the smoke run.
import { drawText } from '../lib/engine/text.ts';
import { drawClimate, CLIMATE_PIC } from './backdrops.ts';
import { drawSetPiece } from './setpieces.ts';
import { drawBaddie, drawBaddiePortrait, BADDIE_ART, BADDIE_EXIT_LOOK } from './baddies.ts';
import { drawMiller } from './npcs.ts';
import { CHALLENGE_ICONS, SKILL_ICONS, SADDLE, drawCarriedEgg } from './missionicons.ts';
import { drawSprite } from './icons.ts';
import { CLIMATES, CHALLENGE_IDS, SKILLS, BADDIE_IDS, BADDIE_FACES } from './missiondata.ts';
import type { Climate, BaddieId } from './missiondata.ts';
import { PHASE_ORDER } from './clock.ts';
import type { DayPhase } from './clock.ts';
import { FLOORS, INK, STRAW_SEAM } from './surfaces.ts';
import { makePet, stepPet, drawPets } from './pet.ts';
import type { Pet } from './pet.ts';
import { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { makeKeeper, stepKeeperAgent, drawKeeperAgent } from '../care/keeper.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { KEEPER_IDS, KEEPERS } from '../art/keeper/cast.ts';
import { DRAGON_ELEMENTS } from '../art/dragon/palettes.ts';

export const SHEETS = ['climates', 'setpieces', 'baddies', 'people', 'icons'] as const;
export type Sheet = typeof SHEETS[number];

/** The gallery's scene shape (gallery.ts Scene), structurally. */
export interface ArtScene { w: number; h: number; pets: Pet[]; step(): void; draw(ctx: CanvasRenderingContext2D): void }

const LABEL = '#3a2a30', SUB = '#6a5a60', PAGE = '#efe8d8';
/** The phases in the sheet's column order. */
const PHASES: readonly DayPhase[] = ['day', 'dusk', 'night', 'dawn'];

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = LABEL, align: 'left' | 'center' = 'center'): void {
  drawText(ctx, text, x, y, { color, align, shadow: false });
}
/** A band of the mission road under feet at `feetY` (its 14 px band, a seam on top, a slab under it), x0..x1. */
export function roadBand(ctx: CanvasRenderingContext2D, x0: number, x1: number, feetY: number): void {
  ctx.fillStyle = FLOORS.road; ctx.fillRect(x0, feetY - 8, x1 - x0, 14);
  ctx.fillStyle = STRAW_SEAM; ctx.fillRect(x0, feetY - 8, x1 - x0, 1);
  ctx.fillStyle = INK; ctx.fillRect(x0, feetY + 6, x1 - x0, 1);
  ctx.fillStyle = '#b8ab92'; ctx.fillRect(x0, feetY + 7, x1 - x0, 5);
}

/**
 * Run `fn` and say whether it changed any pixel inside the rect (x, y, w, h in the ctx's current user space; no
 * rotation). The sheets publish an item only when its drawing really changed pixels, so the smoke run's "every item was
 * drawn" check can fail when a draw call silently draws nothing.
 */
function drew(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fn: () => void): boolean {
  const m = ctx.getTransform();
  const ax = Math.max(0, Math.floor(m.a * x + m.e)), ay = Math.max(0, Math.floor(m.d * y + m.f));
  const aw = Math.min(ctx.canvas.width - ax, Math.ceil(m.a * w)), ah = Math.min(ctx.canvas.height - ay, Math.ceil(m.d * h));
  if (aw <= 0 || ah <= 0) { fn(); return false; }
  const before = ctx.getImageData(ax, ay, aw, ah).data;
  fn();
  const after = ctx.getImageData(ax, ay, aw, ah).data;
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) return true;
  return false;
}

/** Record what a sheet drew on the page's hook. */
function publish(sheet: string, drawn: string[]): void {
  const dc = (globalThis as { __dragonCare?: Window['__dragonCare'] }).__dragonCare;
  if (dc) dc.missionart = { sheet, drawn };
}

/** Build the sheet the query asks for (an unknown sheet: climates). */
export function missionArtScene(search: string): ArtScene {
  const q = new URLSearchParams(search);
  const sheet = (SHEETS as readonly string[]).includes(q.get('sheet') || '') ? q.get('sheet') as Sheet : 'climates';
  const climate = (CLIMATES as readonly string[]).includes(q.get('climate') || '') ? q.get('climate') as Climate : null;
  const phase = (PHASE_ORDER as readonly string[]).includes(q.get('phase') || '') ? q.get('phase') as DayPhase : 'day';
  switch (sheet) {
    case 'setpieces': return setPiecesSheet();
    case 'baddies': return baddiesSheet((BADDIE_IDS as readonly string[]).includes(q.get('id') || '') ? [q.get('id') as BaddieId] : BADDIE_IDS);
    case 'people': return peopleSheet();
    case 'icons': return iconsSheet();
    default: return climate ? roadScene(climate, phase) : climatesSheet();
  }
}

/** The six climates at the four phases, at the chooser's size. */
function climatesSheet(): ArtScene {
  const gx = 8, gy = 14, cw = CLIMATE_PIC.w + 8, ch = CLIMATE_PIC.h + 16, left = 56;
  const w = left + PHASES.length * cw + gx, h = gy + CLIMATES.length * ch + 4;
  return {
    w, h, pets: [], step() { /* still */ },
    draw(ctx) {
      ctx.fillStyle = PAGE; ctx.fillRect(0, 0, w, h);
      PHASES.forEach((p, j) => label(ctx, p.toUpperCase(), left + j * cw + CLIMATE_PIC.w / 2, 4));
      const drawn: string[] = [];
      CLIMATES.forEach((c, i) => {
        label(ctx, c.toUpperCase(), 4, gy + i * ch + CLIMATE_PIC.h / 2 - 3, LABEL, 'left');
        PHASES.forEach((p, j) => {
          const r = { x: left + j * cw, y: gy + i * ch, w: CLIMATE_PIC.w, h: CLIMATE_PIC.h };
          if (drew(ctx, r.x, r.y, r.w, r.h, () => drawClimate(ctx, c, p, r))) drawn.push(`${c}:${p}`);
        });
      });
      publish('climates', drawn);
    },
  };
}

/** One climate filling a road scene (640 x 360: the scene y 16-316, the road at feet 300), scrolling with t. */
function roadScene(climate: Climate, phase: DayPhase): ArtScene {
  let t = 0;
  const w = 640, h = 360;
  return {
    w, h, pets: [], step() { t++; },
    draw(ctx) {
      ctx.fillStyle = PAGE; ctx.fillRect(0, 0, w, h);
      const ok = drew(ctx, 0, 16, w, 290, () => drawClimate(ctx, climate, phase, { x: 0, y: 16, w, h: 290 }, t));
      roadBand(ctx, 0, w, 300);
      ctx.fillStyle = '#9a8a70'; ctx.fillRect(0, 312, w, h - 312);
      label(ctx, `${climate.toUpperCase()} - ${phase.toUpperCase()} - SCROLL ${t}`, w / 2, 3);
      publish('climates', ok ? [`${climate}:${phase}:scene`] : []);
    },
  };
}

/** The set pieces: two to a row of the road, each ahead (left) and met (right); a dragon stands in the fog. */
function setPiecesSheet(): ArtScene {
  let t = 0;
  const cw = 320, ch = 150, cols = 2, rows = Math.ceil(CHALLENGE_IDS.length / cols), w = cw * cols, h = ch * rows;
  const fogAt = CHALLENGE_IDS.indexOf('fog'), fx = (fogAt % cols) * cw, fy = Math.floor(fogAt / cols) * ch;
  // (an adult dragon walking the road through the fog: the fog bank is drawn first, behind it)
  const pets = [makePet('water', 'adult', 3, 'idle', fx + 86, fy + ch - 22, { desync: false })];
  const top = new TopPass(40), budget = new AmbientBudget();
  return {
    w, h, pets, step() { t++; for (const p of pets) stepPet(p); },
    draw(ctx) {
      ctx.fillStyle = PAGE; ctx.fillRect(0, 0, w, h);
      const drawn: string[] = [];
      CHALLENGE_IDS.forEach((id, i) => {
        const x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch, feet = y0 + ch - 22;
        roadBand(ctx, x0, x0 + cw, feet);
        ctx.fillStyle = INK; ctx.fillRect(x0 + cw - 1, y0, 1, ch);
        label(ctx, `${id.toUpperCase()}`, x0 + cw / 2, y0 + 3);
        label(ctx, 'AHEAD', x0 + 80, y0 + ch - 11, SUB); label(ctx, 'MET', x0 + 240, y0 + ch - 11, SUB);
        const a = drew(ctx, x0 + 1, y0 + 12, cw / 2 - 2, ch - 12, () => drawSetPiece(ctx, id, x0 + 80, feet, 'ahead', t));
        const m = drew(ctx, x0 + cw / 2, y0 + 12, cw / 2 - 2, ch - 12, () => drawSetPiece(ctx, id, x0 + 240, feet, 'met', t));
        if (a && m) drawn.push(id);
      });
      drawPets(ctx, pets, { top, budget, frame: t });
      publish('setpieces', drawn);
    },
  };
}

/** The baddies: a row each -- the four faces standing, then walk, the three exits' looks -- and the portraits. */
function baddiesSheet(ids: readonly BaddieId[]): ArtScene {
  let t = 0;
  const cols = 8, cw = 150, rh = 205, w = 60 + cols * cw, h = 20 + ids.length * rh + 44;
  const pets = ids.map((_, i) => makePet('fire', 'adult', 11, 'idle', 34, 20 + i * rh + rh - 30, { desync: false }));
  const top = new TopPass(40), budget = new AmbientBudget();
  return {
    w, h, pets, step() { t++; for (const p of pets) stepPet(p); },
    draw(ctx) {
      ctx.fillStyle = PAGE; ctx.fillRect(0, 0, w, h);
      const drawn: string[] = [];
      ids.forEach((id, i) => {
        const y0 = 20 + i * rh, feet = y0 + rh - 30, B = BADDIE_ART[id];
        roadBand(ctx, 0, w, feet);
        label(ctx, `${B.name}  ${B.w} X ${B.h}  EXIT: ${B.exit.toUpperCase()}`, 60, y0 + 2, LABEL, 'left');
        const cells: [string, () => void][] = [
          ...BADDIE_FACES.map((f): [string, () => void] => [f.toUpperCase(), () => drawBaddie(ctx, id, 0, 0, -1, f, 'stand', t)]),
          ['WALK', () => drawBaddie(ctx, id, 0, 0, -1, 'grumpy', 'walk', t)],
          ...(['calmed', 'outwitted', 'drivenOff'] as const).map((e): [string, () => void] => {
            const L = BADDIE_EXIT_LOOK[e];
            return [e.toUpperCase(), () => drawBaddie(ctx, id, 0, 0, L.facing, L.face, L.pose, t)];
          }),
        ];
        let all = true;
        cells.forEach(([name, draw], j) => {
          const cx = 60 + j * cw + cw / 2;
          all = drew(ctx, cx - cw / 2, y0 + 12, cw, feet - y0, () => { ctx.save(); ctx.translate(cx, feet); draw(); ctx.restore(); }) && all;
          label(ctx, name, cx, feet + 14, SUB);
        });
        if (all) drawn.push(id);
      });
      drawPets(ctx, pets, { top, budget, frame: t });
      const py = h - 36;
      label(ctx, 'PORTRAITS', 8, py + 8, LABEL, 'left');
      BADDIE_IDS.forEach((id, i) => { if (drew(ctx, 80 + i * 40, py, 24, 24, () => drawBaddiePortrait(ctx, id, 80 + i * 40, py))) drawn.push(`${id}:portrait`); });
      publish('baddies', drawn);
    },
  };
}

/** The miller beside the keepers, at 1x (the game's scale) and 3x, and all five as flat silhouettes at a third. */
function peopleSheet(): ArtScene {
  let t = 0;
  const w = 640, h = 360, feet1 = 96, feet3 = 330;
  const keepers: KeeperAgent[] = KEEPER_IDS.map((id, i) => makeKeeper(id, 'idle', 250 + i * 40, feet1, { seed: 3 + i }));
  const off = document.createElement('canvas');
  off.width = 220; off.height = 110;
  const sil = document.createElement('canvas');
  sil.width = 260; sil.height = 110;
  return {
    w, h, pets: [], step() { t++; for (const k of keepers) stepKeeperAgent(k); },
    draw(ctx) {
      ctx.fillStyle = PAGE; ctx.fillRect(0, 0, w, h);
      roadBand(ctx, 0, w, feet1);
      label(ctx, 'THE GRUMPY MILLER AT 1X, BESIDE THE KEEPERS', 8, 4, LABEL, 'left');
      const drawn: string[] = [];
      if (drew(ctx, 20, 14, 80, feet1 - 14, () => drawMiller(ctx, 'grumpy', 60, feet1, 1, t))) drawn.push('miller:grumpy');
      if (drew(ctx, 110, 14, 80, feet1 - 14, () => drawMiller(ctx, 'talkedRound', 150, feet1, 1, t))) drawn.push('miller:talkedRound');
      label(ctx, 'GRUMPY', 60, feet1 + 14, SUB); label(ctx, 'TALKED ROUND', 150, feet1 + 14, SUB);
      keepers.forEach((k, i) => { if (drew(ctx, k.x - 20, 14, 40, feet1 - 14, () => drawKeeperAgent(ctx, k))) drawn.push(KEEPER_IDS[i]); });
      keepers.forEach((k, i) => label(ctx, KEEPERS[KEEPER_IDS[i]].name.toUpperCase(), 250 + i * 40, feet1 + 14, SUB));
      // 2x: both states side by side, under the 1x row
      const g = off.getContext('2d')!;
      g.fillStyle = PAGE; g.fillRect(0, 0, off.width, off.height);
      roadBand(g, 0, off.width, 100);
      drawMiller(g, 'grumpy', 55, 100, 1, t);
      drawMiller(g, 'talkedRound', 165, 100, 1, t);
      ctx.imageSmoothingEnabled = false;
      label(ctx, 'AT 2X', 8, 122, LABEL, 'left');
      ctx.drawImage(off, 0, 0, off.width, off.height, 0, 132, off.width * 2, off.height * 2);
      // the /3 silhouettes: the five drawn flat in ink, then shrunk to a third (and at 1x beside them)
      const s = sil.getContext('2d')!;
      s.clearRect(0, 0, sil.width, sil.height);
      drawMiller(s, 'grumpy', 25, 100, 1, t, INK);
      keepers.forEach((k, i) => { const x = k.x; k.x = 75 + i * 45; k.y = 100; drawKeeperAgent(s, k, { silhouette: INK }); k.x = x; k.y = feet1; });
      label(ctx, 'SILHOUETTES:', 452, 118, LABEL, 'left');
      label(ctx, 'MILLER BEA TOMAS IRIS PIP', 452, 127, SUB, 'left');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sil, 0, 0, sil.width, sil.height, 460, 140, sil.width / 3, sil.height / 3);
      label(ctx, 'AT 1/3', 560, 160, SUB, 'left');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sil, 0, 0, sil.width, sil.height, 452, 190, sil.width * 0.7, sil.height * 0.7);
      publish('people', drawn);
    },
  };
}

/** The icons: challenges and skills at 1x and 3x, the saddle, the carried eggs, the baddies' portraits. */
function iconsSheet(): ArtScene {
  const w = 640, h = 370;
  const off = document.createElement('canvas');
  off.width = 210; off.height = 70;
  return {
    w, h, pets: [], step() { /* still */ },
    draw(ctx) {
      ctx.fillStyle = PAGE; ctx.fillRect(0, 0, w, h);
      const drawn: string[] = [];
      const g = off.getContext('2d')!;
      g.fillStyle = PAGE; g.fillRect(0, 0, off.width, off.height);
      label(ctx, 'CHALLENGES', 8, 6, LABEL, 'left');
      CHALLENGE_IDS.forEach((id, i) => {
        const x = 16 + i * 56;
        const ok = drew(ctx, x - 6, 20, 12, 12, () => drawSprite(ctx, CHALLENGE_ICONS[id], x, 26));
        label(ctx, id.toUpperCase(), x, 36, SUB);
        drawSprite(g, CHALLENGE_ICONS[id], 8 + i * 18, 10);
        if (ok) drawn.push(`challenge:${id}`);
      });
      label(ctx, 'SKILLS', 8, 52, LABEL, 'left');
      SKILLS.forEach((sk, i) => {
        const x = 16 + i * 56;
        const ok = drew(ctx, x - 6, 66, 12, 12, () => drawSprite(ctx, SKILL_ICONS[sk], x, 72));
        label(ctx, sk.toUpperCase(), x, 82, SUB);
        drawSprite(g, SKILL_ICONS[sk], 8 + i * 18, 30);
        if (ok) drawn.push(`skill:${sk}`);
      });
      label(ctx, 'SADDLE', 260, 52, LABEL, 'left');
      if (drew(ctx, 268, 66, 16, 12, () => drawSprite(ctx, SADDLE, 276, 72))) drawn.push('saddle');
      drawSprite(g, SADDLE, 90, 30);
      label(ctx, 'CARRIED EGGS', 330, 52, LABEL, 'left');
      DRAGON_ELEMENTS.forEach((el, i) => { if (drew(ctx, 340 + i * 16 - 7, 70, 14, 16, () => drawCarriedEgg(ctx, el, 340 + i * 16, 78))) drawn.push(`egg:${el}`); drawCarriedEgg(g, el, 120 + i * 12, 40); });
      label(ctx, 'PORTRAITS', 8, 96, LABEL, 'left');
      BADDIE_IDS.forEach((id, i) => { if (drew(ctx, 12 + i * 34, 108, 24, 24, () => drawBaddiePortrait(ctx, id, 12 + i * 34, 108))) drawn.push(`portrait:${id}`); drawBaddiePortrait(g, id, 8 + i * 30, 44); });
      label(ctx, 'AT 3X', 8, 138, LABEL, 'left');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width, off.height, 8, 150, off.width * 3, off.height * 3);
      publish('icons', drawn);
    },
  };
}
