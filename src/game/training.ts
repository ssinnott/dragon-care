// Training (docs/BASE_DESIGN.md 10): the rules the Arena's sparring bouts are fought by -- a dragon's level and its
// XP, its stats (PUFF, POWER, GUARD, SPEED) by element, stage and level, the skills it knows at each level, the ring of
// the seven elements (each strong against the next), a move's outcome, who goes first, the coach's pick and the XP a
// bout brings. Plain data and pure functions: no drawing, no clock and no randomness of its own -- a bout's rolls are the
// arena's (arena.ts: rngAt(seed, BOUT, bout, turn, move), handed in as numbers in [0, 1)), so a bout is the same every
// time from the same world, and the rules can be checked headless (tools/sim-check.ts section 27).
//
// A bout is a spar, never a fight (the Decisions' B8, amended for the arena: "train dragons with one another ... these
// fights should happen in an arena"): nobody is hurt. A move costs the other dragon PUFF -- its breath, the effort of
// keeping up -- and a dragon out of puff has had its bout and naps; its bars fill again in the barn. A skill is always
// one of the dragon's own anims (ART_BIBLE 4.2, section 3): its signature breath (FIRE BREATH, QUILL VOLLEY, GRAVEL
// ROAR, SPARK BOLT, BUBBLE JET, SHRIEK, NIGHTFALL), its preen (`happy`), a yawn, and its element's idle trick (the
// fidget: fire's tail chase, spike's quill groom, rock's sunbathe, lightning's zoomies, water's shake, slinkwing's
// echo-ping, dusk's lamp-bat) as a show-off; a big breath replaces the breath at LV 7.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';

// ---------- levels and XP ----------

/** The highest level (a dragon keeps its XP past it, but levels no further). */
export const MAX_LEVEL = 10;
/** The XP a dragon needs in all to reach `level`: 10 L (L - 1) -- 20 for LV 2, 60 for LV 3 ... 900 for LV 10. */
export function xpFor(level: number): number { return 10 * level * (level - 1); }
/** A dragon's level from its XP (1..MAX_LEVEL). */
export function levelOf(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpFor(l + 1)) l++;
  return l;
}
/** How far through its level a dragon is: its level, the XP into it and the XP the level takes (0 at MAX_LEVEL). */
export function xpInto(xp: number): { level: number; into: number; need: number } {
  const level = levelOf(xp);
  return level >= MAX_LEVEL ? { level, into: 0, need: 0 } : { level, into: xp - xpFor(level), need: xpFor(level + 1) - xpFor(level) };
}

/**
 * The XP a bout brings (BASE_DESIGN 10): the winner 10 x the other's level + 20, the other 5 x the winner's level + 10 --
 * so sparring a dragon of a higher level is how the young catch up (a LV 1 sparring a LV 10 is LV 3 after one bout); a
 * bout that runs out of turns level on points (a draw) brings each 5 x the other's level + 15.
 */
export function boutXp(winnerLv: number, loserLv: number): { winner: number; loser: number } {
  return { winner: 10 * loserLv + 20, loser: 5 * winnerLv + 10 };
}
export function drawXp(otherLv: number): number { return 5 * otherLv + 15; }

// ---------- the ring of the elements ----------

/**
 * Each element's moves are strong against the next in the ring and weak against the one before it (BASE_DESIGN 10: water
 * douses fire, fire singes brambles, roots crack rock, rock grounds lightning, a flash dazzles a night flier, echoes find
 * their way through the dusk, and the moon-lamp pulls the tide) -- one strong, one weak and five even for every element.
 */
export const BEATS: Readonly<Record<DragonElement, DragonElement>> = Object.freeze({
  water: 'fire', fire: 'spike', spike: 'rock', rock: 'lightning', lightning: 'slinkwing', slinkwing: 'dusk', dusk: 'water',
});
/** Why, in the chooser's words. */
export const BEATS_WHY: Readonly<Record<DragonElement, string>> = Object.freeze({
  water: 'WATER DOUSES FIRE', fire: 'FIRE SINGES BRAMBLES', spike: 'ROOTS CRACK ROCK', rock: 'ROCK GROUNDS LIGHTNING',
  lightning: 'A FLASH DAZZLES NIGHT EYES', slinkwing: 'ECHOES FIND THEIR WAY IN THE DUSK', dusk: 'THE MOON-LAMP PULLS THE TIDE',
});
/** An element move's weight against the one it beats, and against the one that beats it. */
export const STRONG = 1.5, WEAK = 2 / 3;
/** How an element's move lands on a dragon of another element: STRONG, WEAK or 1. */
export function typeMult(att: DragonElement, def: DragonElement): number { return BEATS[att] === def ? STRONG : BEATS[def] === att ? WEAK : 1; }

// ---------- stats ----------

/** A dragon's four numbers in the ring: its PUFF (how long it keeps going), POWER, GUARD and SPEED (who goes first). */
export interface Stats { puff: number; power: number; guard: number; speed: number }
export const STAT_NAMES = ['puff', 'power', 'guard', 'speed'] as const;
/**
 * Each element's stats at LV 1 as an adult, from its character (ART_BIBLE section 3): fire the show-off hits hardest,
 * spike is prickly to wear down, rock is a slow boulder, lightning the quickest, water steady, slinkwing quick and dusk
 * calm. Each is worth about the same in a bout: what wins a race of moves is PUFF x GUARD x POWER (how long it lasts
 * against how fast it tires the other: 5200 to 5980), the quicker a little less, since moving first is worth about
 * half a move a bout (measured over every pairing of the seven: sim-check 27).
 */
export const BASE_STATS: Readonly<Record<DragonElement, Readonly<Stats>>> = Object.freeze({
  fire: { puff: 40, power: 14, guard: 10, speed: 11 },
  spike: { puff: 42, power: 11, guard: 12, speed: 9 },
  rock: { puff: 46, power: 10, guard: 13, speed: 5 },
  lightning: { puff: 40, power: 13, guard: 10, speed: 15 },
  water: { puff: 42, power: 12, guard: 11, speed: 10 },
  slinkwing: { puff: 42, power: 13, guard: 10, speed: 13 },
  dusk: { puff: 44, power: 11, guard: 12, speed: 8 },
});
/** What each level adds to every element's stats. */
export const GROWTH: Readonly<Stats> = Object.freeze({ puff: 5, power: 1.5, guard: 1.5, speed: 1 });
/**
 * A stage's weight on the stats: the young at 0.85 (a teen is quick, though: speed 1.05), the adult whole, and the
 * elder never weaker (D21) but steadier -- more guard, a little less speed. A baby doesn't spar.
 */
export const STAGE_STATS: Readonly<Record<Exclude<Stage, 'baby'>, Readonly<Stats>>> = Object.freeze({
  young: { puff: 0.85, power: 0.85, guard: 0.85, speed: 1.05 },
  adult: { puff: 1, power: 1, guard: 1, speed: 1 },
  elder: { puff: 1, power: 1, guard: 1.15, speed: 0.9 },
});
/** A dragon's stats at a stage and level, whole numbers. */
export function statsOf(el: DragonElement, stage: Stage, level: number): Stats {
  const b = BASE_STATS[el], w = STAGE_STATS[stage === 'baby' ? 'young' : stage], l = Math.max(1, Math.min(MAX_LEVEL, level)) - 1;
  const at = (k: keyof Stats) => Math.max(1, Math.round((b[k] + GROWTH[k] * l) * w[k]));
  return { puff: at('puff'), power: at('power'), guard: at('guard'), speed: at('speed') };
}
/**
 * How a dragon's spirits weigh on its POWER in a bout (the missions' good mood, BASE_DESIGN 5.4): happy (mood 0.5 or
 * more: no need asking yet) 1.1, low (under 0: a need at its yellow bubble) 0.9, else 1. Care is how a dragon trains well.
 */
export function spirits(mood: number): number { return mood >= 0.5 ? 1.1 : mood < 0 ? 0.9 : 1; }

/** A stat's stage in a bout: raised by a preen, lowered by a yawn, -2 to +2. */
export const STAGE_MIN = -2, STAGE_MAX = 2;
/** What a stat's stage does to it: +1 x 5/4, +2 x 3/2, -1 x 4/5, -2 x 2/3. */
export function stageMult(n: number): number { return n >= 0 ? (4 + n) / 4 : 4 / (4 - n); }

// ---------- skills ----------

/**
 * A skill's kind: the element's signature breath (and its big breath from LV 7, which replaces it), a show-off (the
 * element's idle trick), a preen (its guard up) and a yawn (the other's power down: a yawn is catching).
 */
export type SkillKind = 'breath' | 'big' | 'show' | 'preen' | 'yawn';
export const SKILL_KINDS: readonly SkillKind[] = Object.freeze(['breath', 'big', 'show', 'preen', 'yawn'] as SkillKind[]);
/** The anim a skill plays (ART_BIBLE 4.2 and the element's own fidget, section 3). */
export type SkillAnim = 'breath' | 'happy' | 'yawn' | 'fidget';
export interface Skill {
  kind: SkillKind;
  /** Its name for this element (FIRE BREATH, ZOOMIES...). */
  name: string;
  anim: SkillAnim;
  /** What it does: costs the other puff (an element move, weighed by the ring; or a plain one, never weighed), or moves a stat's stage. */
  type: 'element' | 'plain' | 'status';
  /** Its strength (0 for a status skill), and the chance it lands (a miss: the other dodges). */
  power: number;
  acc: number;
  /** A status skill's stat move: whose (its own, or the other's), which, and by how much. */
  effect: { who: 'self' | 'other'; stat: 'power' | 'guard'; by: number } | null;
  /** The level it is learned at. */
  level: number;
  /** When in its anim it lands, as a share of the anim's length (the breath's stream at full reach, the preen's flourish, the yawn's peak). */
  impact: number;
}
/** The level each kind is learned at (BASE_DESIGN 10): a breath and a preen from the start, then a yawn, the show-off, and the big breath in the breath's place. */
export const LEARN_AT: Readonly<Record<SkillKind, number>> = Object.freeze({ breath: 1, preen: 1, yawn: 2, show: 4, big: 7 });
/** Each element's names: its breath (the art bible's signatures), its big breath, and its show-off (its idle fidget). */
export const SKILL_NAMES: Readonly<Record<DragonElement, Readonly<Record<'breath' | 'big' | 'show', string>>>> = Object.freeze({
  fire: { breath: 'FIRE BREATH', big: 'BLAZE', show: 'TAIL CHASE' },
  spike: { breath: 'QUILL VOLLEY', big: 'QUILL STORM', show: 'QUILL GROOM' },
  rock: { breath: 'GRAVEL ROAR', big: 'BOULDER ROAR', show: 'SUNBATHE' },
  lightning: { breath: 'SPARK BOLT', big: 'THUNDERBOLT', show: 'ZOOMIES' },
  water: { breath: 'BUBBLE JET', big: 'TIDAL JET', show: 'BIG SHAKE' },
  slinkwing: { breath: 'SHRIEK', big: 'ECHO SHRIEK', show: 'ECHO PING' },
  dusk: { breath: 'NIGHTFALL', big: 'DEEP NIGHTFALL', show: 'LAMP BAT' },
});
/** A skill of an element's (its numbers are every element's; only the names differ). */
export function skillOf(el: DragonElement, kind: SkillKind): Skill {
  switch (kind) {
    case 'breath': return { kind, name: SKILL_NAMES[el].breath, anim: 'breath', type: 'element', power: 10, acc: 0.95, effect: null, level: LEARN_AT.breath, impact: 0.45 };
    case 'big': return { kind, name: SKILL_NAMES[el].big, anim: 'breath', type: 'element', power: 15, acc: 0.85, effect: null, level: LEARN_AT.big, impact: 0.45 };
    case 'show': return { kind, name: SKILL_NAMES[el].show, anim: 'fidget', type: 'plain', power: 8, acc: 1, effect: null, level: LEARN_AT.show, impact: 0.5 };
    case 'preen': return { kind, name: 'PREEN', anim: 'happy', type: 'status', power: 0, acc: 1, effect: { who: 'self', stat: 'guard', by: 1 }, level: LEARN_AT.preen, impact: 0.3 };
    case 'yawn': return { kind, name: 'YAWN', anim: 'yawn', type: 'status', power: 0, acc: 1, effect: { who: 'other', stat: 'power', by: -1 }, level: LEARN_AT.yawn, impact: 0.5 };
  }
}
/**
 * The skills a dragon knows at a level, in the move menu's order (its breath -- or big breath -- first, then the
 * show-off, the preen and the yawn): 2 at LV 1, 3 from LV 2, 4 from LV 4; from LV 7 the big breath in the breath's place.
 */
export function skillsOf(el: DragonElement, level: number): Skill[] {
  const kinds: SkillKind[] = [level >= LEARN_AT.big ? 'big' : 'breath', 'show', 'preen', 'yawn'];
  return kinds.filter((k) => level >= LEARN_AT[k]).map((k) => skillOf(el, k));
}
/** The skills learned going from level `from` to level `to` (a bout's level-up: the toast names them), in learning order. */
export function learnedBetween(el: DragonElement, from: number, to: number): Skill[] {
  return (['yawn', 'show', 'big'] as SkillKind[]).filter((k) => LEARN_AT[k] > from && LEARN_AT[k] <= to).map((k) => skillOf(el, k));
}

// ---------- a move ----------

/** A fighter as the rules see it: its element and stats, and its stats' stages this bout (power, guard, speed). */
export interface Side { el: DragonElement; stats: Readonly<Stats>; power: number; guard: number; speed: number }
/** A side's POWER, GUARD or SPEED with its stage on it. */
export function effective(s: Side, stat: 'power' | 'guard' | 'speed'): number { return s.stats[stat] * stageMult(s[stat]); }
/** What a move does: whether it landed, the puff it costs the other (0 for a status skill or a miss), and a stat moved (null: none, or already at its limit). */
export interface Outcome { hit: boolean; loss: number; moved: { who: 'self' | 'other'; stat: 'power' | 'guard'; by: number } | null }
/** How much a move's puff cost is scaled by (a bout lasts about five turns between even dragons: sim-check 27). */
export const LOSS_SCALE = 0.75;
/**
 * A move's outcome from its two rolls (each in [0, 1): `hitRoll` against the skill's accuracy, `spread` for the cost's
 * 85-100 %): an attack costs the other POWER x (my power / its guard) x the ring's weight (a plain move never weighed)
 * x LOSS_SCALE x the spread, at least 1 when it lands; a status skill always lands, moving its stat's stage by one
 * unless it is already at its limit.
 */
export function outcomeOf(skill: Skill, me: Side, other: Side, hitRoll: number, spread: number): Outcome {
  if (skill.type === 'status') {
    const e = skill.effect!, who = e.who === 'self' ? me : other, now = who[e.stat], to = Math.max(STAGE_MIN, Math.min(STAGE_MAX, now + e.by));
    return { hit: true, loss: 0, moved: to === now ? null : { ...e } };
  }
  if (hitRoll >= skill.acc) return { hit: false, loss: 0, moved: null };
  const w = skill.type === 'element' ? typeMult(me.el, other.el) : 1;
  const loss = skill.power * (effective(me, 'power') / effective(other, 'guard')) * w * LOSS_SCALE * (0.85 + 0.15 * spread);
  return { hit: true, loss: Math.max(1, Math.round(loss)), moved: null };
}
/** Who moves first in a turn: the higher SPEED (with its stage), the player's fighter on a tie. */
export function firstOf(mine: Side, partner: Side): 0 | 1 { return effective(partner, 'speed') > effective(mine, 'speed') ? 1 : 0; }

/**
 * The coach's pick for a side (the partner's every turn, and the player's with AUTO on: BASE_DESIGN 10), from one roll
 * `u` in [0, 1): a yawn early on while the other's power can still go down (one turn in seven, the first three turns),
 * a preen while it is fresh and its guard can still go up (one in seven), else the attack that costs the other most on
 * average (its power x accuracy x the ring's weight: a show-off against the element that beats it).
 */
export function coachPick(skills: readonly Skill[], me: Side, other: Side, puffShare: number, turn: number, u: number): SkillKind {
  const has = (k: SkillKind) => skills.some((s) => s.kind === k);
  if (has('yawn') && turn <= 3 && other.power > STAGE_MIN && u < 0.15) return 'yawn';
  if (has('preen') && puffShare > 0.6 && me.guard < STAGE_MAX && u >= 0.15 && u < 0.3) return 'preen';
  let best: Skill | null = null, bestV = -1;
  for (const s of skills) {
    if (s.type === 'status') continue;
    const v = s.power * s.acc * (s.type === 'element' ? typeMult(me.el, other.el) : 1);
    if (v > bestV) { bestV = v; best = s; }
  }
  return best ? best.kind : skills[0].kind;
}
