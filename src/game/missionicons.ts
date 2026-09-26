// The missions' small sprites (plan S8/S9a): a 9 x 9 icon for each challenge (the chooser's rows, the trip log, the
// scene's banners) and each rider skill, a saddle (a rider's, carried from the Tack Room), and the egg a rider carries
// home (S5's egg art, whole). The icons.ts sprite format: rows of letters, each letter a colour, drawn by icons.ts
// drawSprite with every pixel ringed in #1a1018 ink, so an icon reads at 1x (11 x 11 with its ink). Flat fills, a lit
// pixel or two toward the top left, nothing under 2 px across once inked. Plain data and one hook: safe from Node.
import type { DragonElement } from '../art/dragon/palettes.ts';
import { drawSprite } from './icons.ts';
import type { Sprite } from './icons.ts';
import { eggSprite } from './eggs.ts';
import type { ChallengeId, Skill } from './missiondata.ts';

const sp = (rows: readonly string[], colors: Readonly<Record<string, string>>): Sprite => Object.freeze({ rows: Object.freeze([...rows]), colors: Object.freeze({ ...colors }) });

/** The challenges' icons, 9 x 9 (S8's counters table): what the road puts in the team's way. */
export const CHALLENGE_ICONS: Readonly<Record<ChallengeId, Sprite>> = Object.freeze({
  // PITCH DARK: a crescent moon and a star on the night
  dark: sp(['nnnnnnnnn', 'nnnmmmnsn', 'nnmmnnnnn', 'nmmnnnnnn', 'nmmnnnnsn', 'nmmnnnnnn', 'nnmmnnnnn', 'nnnmmmnnn', 'nnnnnnnnn'], { n: '#2e3a66', m: '#f2d36a', s: '#e8ecf8' }),
  // HEAVY LOAD: a boulder, lit top left, its shadow low right
  heavy: sp(['.........', '...ggg...', '..gghgg..', '.gghhggg.', '.gggggggd', 'ggggggddd', 'gggggdddd', '.ggddddd.', '..ddddd..'], { g: '#a8a096', h: '#d4cec4', d: '#766f66' }),
  // THE COLD: a snowflake
  cold: sp(['....w....', '.w..w..w.', '..w.w.w..', '...www...', 'wwwwwwwww', '...www...', '..w.w.w..', '.w..w..w.', '....w....'], { w: '#bfe4f8' }),
  // STORM: a cloud and its bolt
  storm: sp(['..ccc....', '.ccccccc.', 'ccccccccc', '.ccccccc.', '...yy....', '..yy.....', '.yyyyy...', '...yy....', '..yy.....'], { c: '#c8ccd8', y: '#ffe45a' }),
  // SPRING FLOOD: water over the road, two wave crests
  flood: sp(['.........', '.bb...bb.', 'bbbb.bbbb', 'bwbbbwbbb', '.........', '.bb...bb.', 'bbbb.bbbb', 'bbbwbbbwb', 'bbbbbbbbb'], { b: '#4aa8d8', w: '#cdeefa' }),
  // THORNS: a bramble stem with its thorns and a berry
  thorns: sp(['......rr.', '.....trr.', '....gg...', '...ggt...', '..tgg....', '..gg.....', '.gg.t....', 'ggt......', 'gg.......'], { g: '#5a8a3a', t: '#d8c888', r: '#9a3a6a' }),
  // LOST THINGS: a question
  lost: sp(['..qqqqq..', '.qq...qq.', '......qq.', '.....qq..', '....qq...', '....qq...', '.........', '....qq...', '....qq...'], { q: '#f2b43a' }),
  // GRUMPY MILLER: a windmill, its sails crossed over its cap
  miller: sp(['s.......s', 'ss.....ss', '.ss.r.ss.', '..srrrs..', '..rrsrr..', '..ss.ss..', '.wwwwwww.', '.wwwdwww.', '.wwwdwww.'], { s: '#f3e6c8', r: '#b04e3a', w: '#d8cbb0', d: '#6a4636' }),
  // HURT ANIMAL: a sticking plaster (cozy: a plaster, never a wound)
  hurt: sp(['......ll.', '.....llll', '....lllll', '...lppll.', '..lpppl..', '.llppl...', 'lllll....', 'llll.....', '.ll......'], { l: '#e8b48c', p: '#fff4e8' }),
  // THICK FOG: flat bands of it
  fog: sp(['.........', '.fffffff.', 'fffffffff', '.........', '..fffffff', 'fffffffff', '.........', '.fffffff.', 'fffffff..'], { f: '#d4d8dc' }),
  // NARROW GAP: two rocks with a crack of a way between them
  gap: sp(['.rrr...rr', 'rhrr...rr', 'rrrr...hr', 'rrr...rrr', 'rrrr...rr', 'rrrr...rr', 'rrr...rrr', 'rrrr...rr', 'rrrr...rr'], { r: '#b0a494', h: '#d8d0c2' }),
});

/** The rider skills' icons, 9 x 9 (P13): Bea CHARM, Tomas MEDIC, Iris NAVIGATOR, Pip NIMBLE. */
export const SKILL_ICONS: Readonly<Record<Skill, Sprite>> = Object.freeze({
  // CHARM: a kind word (a speech bubble with a heart)
  charm: sp(['.wwwwwww.', 'wwpwwwpww', 'wpppwpppw', 'wwpppppww', 'wwwpppwww', '.wwwpwww.', '..ww.....', '.ww......', '.........'], { w: '#fbf7ee', p: '#e8507a' }),
  // MEDIC: the first-aid cross
  medic: sp(['wwwwwwwww', 'wwwrrrwww', 'wwwrrrwww', 'wrrrrrrrw', 'wrrrrrrrw', 'wrrrrrrrw', 'wwwrrrwww', 'wwwrrrwww', 'wwwwwwwww'], { w: '#f6ecd6', r: '#d8402e' }),
  // NAVIGATOR: a compass, its north needle red
  navigator: sp(['..ggggg..', '.gwwrwwg.', 'gwwwrwwwg', 'gwwrrrwwg', 'gwwwbwwwg', 'gwwwbwwwg', 'gwwwbwwwg', '.gwwwwwg.', '..ggggg..'], { g: '#c8a050', w: '#f6ecd6', r: '#d8402e', b: '#3d5f94' }),
  // NIMBLE: a feather
  nimble: sp(['.......ff', '......fff', '.....fwff', '....fwff.', '...fwff..', '..fwff...', '.fff.....', '.f.......', 'f........'], { f: '#78b84a', w: '#e8f4d8' }),
});

/** A rider's saddle (11 x 7): its seat, its pommel and cantle, a strap and a stirrup either side. */
export const SADDLE: Sprite = sp([
  'bb.......bb',
  'bbb.....bbb',
  'bhbbbbbbbbb',
  '.bbbbbbbbb.',
  '..l.....l..',
  '..l.....l..',
  '.sss...sss.',
], { b: '#8c4a3a', h: '#b0664e', l: '#5a3a2a', s: '#c8c4bc' });

/** The egg a rider carries home (S5's egg, whole: its baby's scale colour, the belly spot, inked round). */
export function carriedEgg(el: DragonElement): Sprite { return eggSprite(el, 0); }
/** Draw the carried egg centred on (cx, cy). */
export function drawCarriedEgg(ctx: CanvasRenderingContext2D, el: DragonElement, cx: number, cy: number): void { drawSprite(ctx, carriedEgg(el), cx, cy); }
