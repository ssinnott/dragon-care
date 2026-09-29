// The fights' marks (docs/BASE_DESIGN.md 6; ART_BIBLE 5.10): what flies and what lands when the team fights a pack
// of little enemies or a boss -- each element's breath bolt (a dragon's breath, thrown), the enemies' missiles (a clod,
// a pebble, a thorn burr, a zap, a snowball, an ember: one per region, a boss's big), the spark where a hit lands, the
// puff of smoke a worn-out foe goes up in, and the stars round a sat-down boss's head. All in the house style: small
// sprites in the icons.ts format (every pixel ringed in #1a1018 ink), flat fills, no alpha, no mark under 2 px; each a
// pure function of its age or the scene's step, so a frozen frame is the same every time. Nothing here is a wound: a
// hit is a spark, a worn-out foe a puff of smoke (BASE_DESIGN B8).
import { drawSprite } from './icons.ts';
import type { Sprite } from './icons.ts';
import { INK } from './surfaces.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { RegionId } from './missiondata.ts';

const sp = (rows: readonly string[], colors: Readonly<Record<string, string>>): Sprite => Object.freeze({ rows: Object.freeze([...rows]), colors: Object.freeze({ ...colors }) });
/** A sprite mirrored left to right (a missile flying the other way). */
function mirror(s: Sprite): Sprite { return sp(s.rows.map((r) => [...r].reverse().join('')), s.colors); }

/**
 * Each element's breath bolt (flying right, the way the team faces a fight): the breath the dragon's anim shows at its
 * mouth, thrown -- fire's fireball, lightning's zig-zag, water's bubble ball, rock's pebble, spike's quill, slinkwing's
 * sound rings, dusk's nightfall orb with its star. 5 to 7 px, 7 to 9 with its ink.
 */
export const BOLTS: Readonly<Record<DragonElement, Sprite>> = Object.freeze({
  fire: sp(['.rrr.', 'rooor', 'roYyo', 'rooor', '.rrr.'], { r: '#e0482a', o: '#f08a2e', y: '#ffd24a', Y: '#fff2a8' }),
  lightning: sp(['...yy', '..yy.', '.yyyy', '..yy.', 'yy...'], { y: '#ffe45a' }),
  water: sp(['.bbb.', 'bwbbb', 'bbbbb', 'bbbdb', '.bbb.'], { b: '#6cc4e0', w: '#eefaff', d: '#3a8ab0' }),
  rock: sp(['.hhh.', 'hhggg', 'ggggd', '.gddd'], { h: '#d2b48c', g: '#a8865e', d: '#6e5438' }),
  spike: sp(['wwwwwgg', '.wwwwg.'], { w: '#f4eedc', g: '#5cc45a' }),
  slinkwing: sp(['p..p.', '.p..p', '.p..p', '.p..p', 'p..p.'], { p: '#f070b0' }),
  dusk: sp(['.nnn.', 'nnnnn', 'nnsnn', 'nnnnn', '.nnn.'], { n: '#4a5a8c', s: '#fff2a8' }),
});

/** The enemies' missiles, one kind per region (its foes and its boss throw it): what each kind is made of. */
export type MissileKind = 'clod' | 'pebble' | 'burr' | 'zap' | 'snowball' | 'ember';
export const REGION_MISSILE: Readonly<Record<RegionId, MissileKind>> = Object.freeze({
  millbrook: 'clod', oldmine: 'pebble', bramblewood: 'burr', highfold: 'zap', frostmere: 'snowball', emberfell: 'ember',
});
/** Each kind small (a foe's, 5 px) and big (a boss's, 7 px), flying left toward the team. */
export const MISSILES: Readonly<Record<MissileKind, { small: Sprite; big: Sprite }>> = Object.freeze({
  clod: { small: sp(['.mmm.', 'mmmdm', '.mddm', '..dd.'], { m: '#8a6440', d: '#5a4028' }),
    big: sp(['..mmm..', '.mmmmm.', 'mmhmmdm', 'mmmmddm', '.mddddm', '..ddd..'], { m: '#8a6440', h: '#b08a5c', d: '#5a4028' }) },
  pebble: { small: sp(['.hhh.', 'hhggg', 'ggggd', '.gdd.'], { h: '#c8bcaa', g: '#958a7a', d: '#6a6054' }),
    big: sp(['..hhh..', '.hhggg.', 'hggggdd', 'gggggdd', '.gggdd.', '..ddd..'], { h: '#c8bcaa', g: '#958a7a', d: '#6a6054' }) },
  burr: { small: sp(['t.t.t', '.ggg.', 'tghgt', '.ggg.', 't.t.t'], { g: '#3e5a2e', h: '#5e8246', t: '#c8b878' }),
    big: sp(['t..t..t', '.gggg..', '.gghgg.', 'tgggggt', '.ggggg.', '..gggg.', 't..t..t'], { g: '#3e5a2e', h: '#5e8246', t: '#c8b878' }) },
  zap: { small: sp(['y...y', '.yyy.', '.yWy.', '.yyy.', 'y...y'], { y: '#ffe45a', W: '#fffbe0' }),
    big: sp(['y..y..y', '.yyyyy.', '.yWWWy.', 'yyWWWyy', '.yWWWy.', '.yyyyy.', 'y..y..y'], { y: '#ffe45a', W: '#fffbe0' }) },
  snowball: { small: sp(['.www.', 'wwwws', 'wwwss', '.sss.'], { w: '#f4f8fc', s: '#b8cce0' }),
    big: sp(['..www..', '.wwwww.', 'wwwwwws', 'wwwwwss', '.wwssss', '..sss..'], { w: '#f4f8fc', s: '#b8cce0' }) },
  ember: { small: sp(['.ooo.', 'oyyor', 'ooorr', '.rrr.'], { o: '#f08a2e', y: '#ffd24a', r: '#b83a22' }),
    big: sp(['..ooo..', '.oyyoo.', 'oyyyoor', 'ooyoorr', '.oorrr.', '..rrr..'], { o: '#f08a2e', y: '#ffd24a', r: '#b83a22' }) },
});

const MIRRORED = new Map<Sprite, Sprite>();
/** A sprite facing `dir` (1: as drawn, right; -1: mirrored). */
function facing(s: Sprite, dir: 1 | -1): Sprite {
  if (dir === 1) return s;
  let m = MIRRORED.get(s);
  if (!m) { m = mirror(s); MIRRORED.set(s, m); }
  return m;
}

/** Two 2 px puffs trailing a flying mark along its way (dx, dy: its step, screen px), the second fainter by being smaller -- never alpha. */
function trail(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string): void {
  const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
  for (const [back, s] of [[7, 2], [12, 2]] as const) {
    const px = Math.round(x - ux * back), py = Math.round(y - uy * back);
    ctx.fillStyle = INK; ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
    ctx.fillStyle = color; ctx.fillRect(px, py, s, s);
  }
}

/** A dragon's breath bolt in flight at (x, y), moving (dx, dy) a step: its element's sprite, the way it flies, and a short trail. */
export function drawBolt(ctx: CanvasRenderingContext2D, el: DragonElement, x: number, y: number, dx: number, dy: number): void {
  const s = facing(BOLTS[el], dx < 0 ? -1 : 1);
  trail(ctx, x, y, dx, dy, s.colors[Object.keys(s.colors)[0]]);
  drawSprite(ctx, s, x, y);
}

/** An enemy's missile in flight at (x, y), moving (dx, dy) a step (big: a boss's), with its trail. */
export function drawMissile(ctx: CanvasRenderingContext2D, kind: MissileKind, big: boolean, x: number, y: number, dx: number, dy: number): void {
  const M = MISSILES[kind], s = facing(big ? M.big : M.small, dx < 0 ? -1 : 1);
  if (big) trail(ctx, x, y, dx, dy, s.colors[Object.keys(s.colors)[0]]);
  drawSprite(ctx, s, x, y);
}

/** Steps a hit's spark shows, and a worn-out foe's puff of smoke. */
export const SPARK_LEN = 12, POOF_LEN = 30;

const SPARK_S = sp(['..w..', '.wyw.', 'wyyyw', '.wyw.', '..w..'], { w: '#fffbe8', y: '#ffe45a' });
const SPARK_L = sp(['....w....', '....w....', '..w.y.w..', '...yyy...', 'wwyyWyyww', '...yyy...', '..w.y.w..', '....w....', '....w....'], { w: '#fffbe8', y: '#ffe45a', W: '#ffffff' });
/** A hit landing at (x, y), `age` steps ago (0..SPARK_LEN): a small star, a big burst, then four sparks flying out. */
export function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, age: number): void {
  if (age < 0 || age >= SPARK_LEN) return;
  if (age < 3) { drawSprite(ctx, SPARK_S, x, y); return; }
  if (age < 8) { drawSprite(ctx, SPARK_L, x, y); return; }
  const d = 5 + (age - 8) * 2;
  for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const px = Math.round(x + ux * d), py = Math.round(y + uy * d);
    ctx.fillStyle = INK; ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.fillStyle = '#ffe45a'; ctx.fillRect(px - 1, py - 1, 2, 2);
  }
}

const STAR = sp(['..y..', '..y..', 'yyWyy', '.yyy.', '.y.y.'], { y: '#ffd24a', W: '#fff2a8' });
/** A worn-out foe going up in smoke at (x, y) (its body's middle), `age` steps ago (0..POOF_LEN): three puffs swelling and thinning away, two stars popping up. */
export function drawPoof(ctx: CanvasRenderingContext2D, x: number, y: number, age: number): void {
  if (age < 0 || age >= POOF_LEN) return;
  const u = age / POOF_LEN, grow = Math.round(2 + Math.min(1, u * 2.5) * 5), shrink = u > 0.6 ? Math.round((u - 0.6) * 12) : 0, r = Math.max(2, grow - shrink);
  const puffs: readonly (readonly [number, number, number])[] = [[-5, 1, 0], [4, 2, 1], [0, -5, 1]];
  for (const [dx, dy, k] of puffs) {
    const cx = Math.round(x + dx * (1 + u)), cy = Math.round(y + dy * (1 + u) - u * 4), rr = r - k;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, rr + 1, 0, Math.PI * 2); ctx.fill();
  }
  for (const [dx, dy, k] of puffs) {
    const cx = Math.round(x + dx * (1 + u)), cy = Math.round(y + dy * (1 + u) - u * 4), rr = r - k;
    ctx.fillStyle = '#ece8e0'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0cabe'; ctx.fillRect(cx - 1, cy + Math.max(1, rr - 3), Math.max(2, rr), 2);
  }
  if (age >= 6) for (const [dx, sx] of [[-9, -1], [9, 1]] as const) drawSprite(ctx, STAR, Math.round(x + dx + sx * (age - 6) * 0.3), Math.round(y - 8 - (age - 6) * 0.6));
}

/** Three stars circling over a knocked-down head at (x, y), stepping round every 5 steps (the scene's step `t`). */
export function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const k = Math.floor(t / 5);
  for (let i = 0; i < 3; i++) {
    const a = ((k % 12) / 12 + i / 3) * Math.PI * 2;
    drawSprite(ctx, STAR, Math.round(x + Math.cos(a) * 16), Math.round(y + Math.sin(a) * 5));
  }
}
