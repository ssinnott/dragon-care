// The Arena (docs/BASE_DESIGN.md 10): training bouts, the simulation's half. The rules are training.ts's; this is the
// bout itself, step by step. Two dragons -- the player's and its sparring partner -- leave what they were doing (a
// keeper at work with one finishes first; a sleeper wakes first; each keeps its slot until it sets off), ride the
// Dragon Lift up to the roof at the car's first priority, and walk off its car east onto the Arena deck, each to a
// corner -- the first up takes the east corner, so the second never walks through it -- and face each other (the arena
// used: #11). A beat, and then turn by turn: the player picks its dragon's move (a command: control.ts) -- or its coach
// does, with AUTO on, or once the pick has waited PICK_WAIT (the view makes the world wait while its move menu is up, so
// that only runs out with the player away) -- and the partner's coach picks its own; the quicker moves first. Each move
// is its dragon's own anim, played through while the simulation holds both still, and lands at its impact (rolled then:
// rngAt(seed, BOUT, bout, turn, move)): the other's puff goes down, or a stat's stage moves. A dragon out of puff has
// had its bout; after MAX_TURNS the bout goes to the one with the most puff left (as a share), or is a draw. At the
// end both get XP -- and the levels it brings, and a level's new skills (the view's toasts) -- the one out of puff
// lies down for a nap and wakes, the winner preens, and both are tired and hungry (food and sleep at most TIRED: a
// burst of bubbles back in the barn). Then they walk back down to the nearest free slots, the west corner first, and
// their needs take over; the bout is over once both are off the Arena deck.
//
// While its bout is on (its goal `bout`) a fighter asks for nothing and its needs wait, as a mission team's do away:
// nothing drains it empty whatever the player leaves waiting (a job or a nap under way when the bout began runs on to
// its end: sim.ts step). Nobody is ever hurt (the Decisions' B8, amended for the
// arena): a move costs puff, never health -- no knockback, no hurt pose, nothing flung; the other only looks surprised,
// and whoever is out of puff naps. DOM-free and deterministic: every roll a stateless rngAt, every loop in order, and
// the whole state plain data the save keeps (CareSim.arena).
import { rngAt, TAG } from './rand.ts';
import { AERIE_F, ARENA_X0, arenaSpot } from './layout.ts';
import { nearestFree, sendTo, faceWay, raiseCall } from './travel.ts';
import { leaveBarn, mayGo, dragonTo, standsAt } from './missions.ts';
import { animLen } from './gait.ts';
import { NEEDS, SOON, hasNeed } from './needs.ts';
import type { NeedKind } from './needs.ts';
import {
  levelOf, statsOf, spirits, skillOf, skillsOf, outcomeOf, firstOf, coachPick, boutXp, drawXp, learnedBetween, typeMult,
  SKILL_KINDS, STAGE_MIN, STAGE_MAX,
} from './training.ts';
import type { Stats, SkillKind, Side } from './training.ts';
import type { CareSim, Dragon } from './sim.ts';
import type { DFaceName } from '../art/dragon/pose.ts';

// ---------- the state ----------

/**
 * A bout's state: its fighters walking up to their corners (`muster`); facing each other a beat (`face`); waiting for
 * the player's pick (`pick`); a turn's moves playing (`play`); decided -- a nap, a preen (`over`); and walking home
 * (`home`), until both are off the Arena deck.
 */
export type BoutState = 'muster' | 'face' | 'pick' | 'play' | 'over' | 'home';
export const BOUT_STATES: readonly BoutState[] = Object.freeze(['muster', 'face', 'pick', 'play', 'over', 'home'] as BoutState[]);

/**
 * A fighter: its dragon (by id); its corner (0 the west, facing east; 1 the east, facing west), taken as it steps off
 * the car onto the roof -- null until then; its level and stats at the bout's start (its spirits on its power:
 * training.ts spirits); the puff it has left; and its stats' stages this bout (-2..+2).
 */
export interface Fighter { dragon: number; corner: 0 | 1 | null; level: number; stats: Stats; puff: number; power: number; guard: number; speed: number }

/**
 * A move in a turn: whose (0 the player's fighter, 1 the partner), which skill, its place in the turn (0 or 1), the
 * steps it has played (0..len + MOVE_GAP), its anim's length and the step it lands at; and once it has landed, whether
 * it hit, the puff it cost the other and the stage it moved (null: none).
 */
export interface Move {
  by: 0 | 1;
  skill: SkillKind;
  n: 0 | 1;
  t: number;
  len: number;
  at: number;
  landed: boolean;
  hit: boolean;
  loss: number;
  moved: { who: 'self' | 'other'; stat: 'power' | 'guard'; by: number } | null;
}

/**
 * A bout: its id (the arena's count when it began: every roll's key); its two fighters, the player's first; its state and
 * the steps it has been in it; the turns begun; AUTO (the coach picks the player's moves too); the player's pick waiting
 * for the next turn; this turn's moves and the one playing; once decided, the winner (0 or 1; null: a draw) and the XP
 * each got; and its lines, the latest last (the view shows them).
 */
export interface Bout {
  id: number;
  fighters: [Fighter, Fighter];
  state: BoutState;
  t: number;
  turn: number;
  auto: boolean;
  pick: SkillKind | null;
  moves: Move[];
  cur: number;
  winner: 0 | 1 | null;
  xp: [number, number];
  log: string[];
}

/** What the save keeps of the arena: the bout on (null: none) and the bouts begun in all (the next one's id). */
export interface ArenaState { bout: Bout | null; bouts: number }
export function newArena(): ArenaState { return { bout: null, bouts: 0 }; }

// ---------- numbers (BASE_DESIGN 10) ----------

/**
 * Steps: the two fighters face each other before the first turn (1 s); the player's pick waits for them before the coach
 * steps in (5 s: the view makes the world wait while its move menu is up, so this runs out only with the bout left on
 * from the barn, BACK TO BARN); between one move
 * and the next; the turns a bout lasts at most; the nap of the one out of puff, once it lies down (2.5 s); and how
 * long after the west corner the east one sets off for home, so the two never walk nose into head.
 */
export const FACE_STEPS = 60, PICK_WAIT = 300, MOVE_GAP = 24, MAX_TURNS = 12, NAP_STEPS = 150, HOME_GAP = 150;
/** After a bout, food and sleep at most this: tired and hungry (a mission lands them lower: missions.ts LAND_NEEDS). */
export const TIRED = 0.6;
/** A bout's lines kept (the view shows the latest). */
export const LOG_MAX = 8;
/** How long the other shows its face after a move lands on it (a surprised look, a dodge's grin, a yawn caught), steps. */
export const FACE_FRAMES = 36;
/** The word for a need too low to spar with (its yellow bubble, SOON): the chooser's greyed reason. */
export const LOW_NEED: Readonly<Record<NeedKind, string>> = Object.freeze({ food: 'HUNGRY', sleep: 'SLEEPY', play: 'BORED', bath: 'GRUBBY', love: 'LONELY' });

// ---------- who may spar ----------

const dragonOf = (sim: CareSim, id: number): Dragon => { const d = sim.dragons.find((q) => q.id === id); if (!d) throw new Error(`arena: no dragon ${id}`); return d; };

/**
 * Why a dragon can't spar now (the chooser's greyed word), or null: it can. In the garden or on its way there; away
 * with a mission's team (or mustering for one); a baby; or a need at its yellow bubble (SOON) or lower -- it goes to its
 * keeper first. (One being met, asleep or growing up may be picked: the bout waits for it, as a mission's muster does.)
 */
export function fighterReason(sim: CareSim, d: Dragon): string | null {
  if (d.place === 'garden' || d.goal === 'retire') return 'IN THE GARDEN';
  if (d.place === 'away' || d.goal === 'muster' || sim.missions.trip?.pairs.some((p) => p.dragon === d.id)) return 'AWAY';
  if (d.stage === 'baby') return 'BABY';
  let low: NeedKind | null = null;
  for (const k of NEEDS) if (hasNeed(d.element, k) && d.needs[k] < SOON && (!low || d.needs[k] < d.needs[low])) low = k;
  return low ? LOW_NEED[low] : null;
}

/** Why the Arena can't hold a bout of these two now (START's greyed words), or null: it can. */
export function canSpar(sim: CareSim, a: number | null, b: number | null): string | null {
  const bout = sim.arena.bout;
  if (bout) return bout.state === 'home' ? 'THE LAST PAIR IS WALKING HOME' : 'A BOUT IS ON';
  if (a == null || b == null || a === b) return 'PICK TWO DRAGONS';
  for (const id of [a, b]) {
    const d = sim.dragons.find((q) => q.id === id);
    if (!d) return 'PICK TWO DRAGONS';
    const why = fighterReason(sim, d);
    if (why) return `${d.name} IS ${why === 'BABY' ? 'A BABY' : why}`;
  }
  return null;
}

/** A dragon's fighter at a bout's start: its level and stats (its spirits on its power), full of puff, no stages. */
function fighterOf(d: Dragon): Fighter {
  const level = levelOf(d.xp), s = statsOf(d.element, d.stage, level);
  const stats = { ...s, power: Math.max(1, Math.round(s.power * spirits(d.mood))) };
  return { dragon: d.id, corner: null, level, stats, puff: stats.puff, power: 0, guard: 0, speed: 0 };
}

/**
 * Begin a bout (the Arena's START: a `bout` command): refused with canSpar's reason, else the two fighters' jobs are
 * dropped -- a keeper at work with one finishes -- and their goal is the bout (they ask for nothing now), and the
 * muster begins. `a` is the player's dragon (its moves are the player's to pick), `b` its sparring partner.
 */
export function startBout(sim: CareSim, a: number, b: number): Bout | string {
  const why = canSpar(sim, a, b);
  if (why) return why;
  const da = dragonOf(sim, a), db = dragonOf(sim, b);
  const bout: Bout = { id: sim.arena.bouts++, fighters: [fighterOf(da), fighterOf(db)], state: 'muster', t: 0, turn: 0, auto: false, pick: null, moves: [], cur: 0, winner: null, xp: [0, 0], log: [] };
  sim.arena.bout = bout;
  for (const d of [da, db]) { leaveBarn(sim, d); d.goal = 'bout'; }
  bout.log.push(`${da.name} AND ${db.name} HEAD UP TO THE ARENA`);
  return bout;
}

/**
 * A bout begun at once, as if both fighters had walked up and stood in their corners (the `bout` preset, presets.ts: a
 * bout to look at from the first frame): the world's bout -- refused as startBout refuses -- its fighters' jobs, acts,
 * naps and slots let go (missions.ts leaveBarn, at once), the player's in the west corner and its partner in the east,
 * each on the roof at its spot facing the other, the bout at `face` (its first pick FACE_STEPS on). No room is counted
 * used: nobody walked up. Only for a world whose fighters stand still, off the lift (a preset's, before its first step).
 */
export function boutNow(sim: CareSim, a: number, b: number): Bout {
  const bout = startBout(sim, a, b);
  if (typeof bout === 'string') throw new Error(`arena: ${bout}`);
  bout.fighters.forEach((f, i) => {
    const d = dragonOf(sim, f.dragon), corner = i as 0 | 1;
    leaveBarn(sim, d, true);
    f.corner = corner;
    d.f = AERIE_F; d.x = arenaSpot(d.stage, corner); d.facing = corner === 0 ? 1 : -1;
    d.legs = []; d.move = 'still'; d.gaitT = 0; d.turn = -1; d.waited = 0;
  });
  bout.state = 'face'; bout.t = 0;
  const [x, y] = bout.fighters.map((f) => dragonOf(sim, f.dragon));
  bout.log.push(`${x.name} (LV ${bout.fighters[0].level}) AND ${y.name} (LV ${bout.fighters[1].level}) FACE EACH OTHER`);
  return bout;
}

/** The player's pick for the turn waiting (a `skill` command): one its fighter knows, and only while a turn waits for it. */
export function pickSkill(sim: CareSim, kind: SkillKind): void {
  const b = sim.arena.bout;
  if (!b || b.state !== 'pick' || !SKILL_KINDS.includes(kind)) return;
  const f = b.fighters[0], d = dragonOf(sim, f.dragon);
  if (skillsOf(d.element, f.level).some((s) => s.kind === kind)) b.pick = kind;
}
/** AUTO on or off (a `coach` command): the coach picks the player's moves too. */
export function setCoach(sim: CareSim, on: boolean): void { const b = sim.arena.bout; if (b) b.auto = on; }

// ---------- a step ----------

/** A fighter as the rules see it (training.ts Side): its element, stats and stages. */
export function sideOf(sim: CareSim, f: Fighter): Side { return { el: dragonOf(sim, f.dragon).element, stats: f.stats, power: f.power, guard: f.guard, speed: f.speed }; }

/** The coach's pick for fighter i this turn (training.ts coachPick), from its own roll. */
function coachFor(sim: CareSim, b: Bout, i: 0 | 1): SkillKind {
  const f = b.fighters[i], d = dragonOf(sim, f.dragon);
  return coachPick(skillsOf(d.element, f.level), sideOf(sim, f), sideOf(sim, b.fighters[1 - i]), f.puff / f.stats.puff, b.turn, rngAt(sim.seed, TAG.BOUT, b.id, b.turn, 2 + i).next());
}

/** A turn begins: each fighter's move (the player's pick, or its coach's), the quicker first. */
function beginTurn(sim: CareSim, b: Bout): void {
  b.turn++;
  const picks = [b.pick ?? coachFor(sim, b, 0), coachFor(sim, b, 1)] as const;
  b.pick = null;
  const first = firstOf(sideOf(sim, b.fighters[0]), sideOf(sim, b.fighters[1]));
  b.moves = (first === 0 ? [0, 1] as const : [1, 0] as const).map((by, n): Move => {
    const d = dragonOf(sim, b.fighters[by].dragon), skill = skillOf(d.element, picks[by]), len = animLen(d.element, d.stage, skill.anim);
    return { by, skill: skill.kind, n: n as 0 | 1, t: 0, len, at: Math.max(1, Math.round(len * skill.impact)), landed: false, hit: false, loss: 0, moved: null };
  });
  b.cur = 0; b.state = 'play'; b.t = 0;
}

/** A move lands: its rolls, the other's puff, a stat's stage, and its line. */
function land(sim: CareSim, b: Bout, m: Move): void {
  const me = b.fighters[m.by], other = b.fighters[1 - m.by], dm = dragonOf(sim, me.dragon), dn = dragonOf(sim, other.dragon);
  const skill = skillOf(dm.element, m.skill), r = rngAt(sim.seed, TAG.BOUT, b.id, b.turn, m.n);
  const o = outcomeOf(skill, sideOf(sim, me), sideOf(sim, other), r.next(), r.next());
  m.landed = true; m.hit = o.hit; m.loss = o.loss; m.moved = o.moved;
  other.puff = Math.max(0, other.puff - o.loss);
  if (o.moved) { const who = o.moved.who === 'self' ? me : other; who[o.moved.stat] = Math.max(STAGE_MIN, Math.min(STAGE_MAX, who[o.moved.stat] + o.moved.by)); }
  const w = skill.type === 'element' ? typeMult(dm.element, dn.element) : 1;
  let line: string;
  if (skill.kind === 'preen') line = o.moved ? `${dm.name} PREENS: GUARD UP` : `${dm.name} PREENS: ITS GUARD IS AS HIGH AS IT GOES`;
  else if (skill.kind === 'yawn') line = o.moved ? `${dm.name} YAWNS AND ${dn.name} CATCHES IT: POWER DOWN` : `${dm.name} YAWNS: ${dn.name} IS AS DROWSY AS IT GETS`;
  else if (!o.hit) line = `${dm.name}'S ${skill.name}: ${dn.name} DODGES!`;
  else line = `${dm.name}'S ${skill.name}: ${dn.name} -${o.loss} PUFF${w > 1 ? ', A STRONG ONE!' : w < 1 ? ', A WEAK ONE' : ''}`;
  b.log.push(line);
  if (b.log.length > LOG_MAX) b.log.splice(0, b.log.length - LOG_MAX);
}

/**
 * The bout is decided: the winner (the one with puff left; after MAX_TURNS the most puff left as a share of its whole,
 * or a draw), the XP (training.ts boutXp, drawXp) with the levels and the skills it brings (events: `boutEnd`, `level`,
 * `learn`), and both fighters tired and hungry (TIRED).
 */
function decide(sim: CareSim, b: Bout): void {
  const [p, q] = b.fighters, share = (f: Fighter) => f.puff / f.stats.puff;
  b.winner = p.puff <= 0 && q.puff > 0 ? 1 : q.puff <= 0 && p.puff > 0 ? 0 : share(p) > share(q) ? 0 : share(q) > share(p) ? 1 : null;
  const gain = (i: 0 | 1): number => {
    const other = b.fighters[1 - i].level;
    if (b.winner == null) return drawXp(other);
    const x = b.winner === 0 ? boutXp(p.level, q.level) : boutXp(q.level, p.level);
    return b.winner === i ? x.winner : x.loser;
  };
  b.xp = [gain(0), gain(1)];
  const ds = b.fighters.map((f) => dragonOf(sim, f.dragon));
  b.log.push(b.winner == null ? `A DRAW ON POINTS: ${ds[0].name} +${b.xp[0]} XP, ${ds[1].name} +${b.xp[1]} XP`
    : `${ds[b.winner].name} WINS${p.puff > 0 && q.puff > 0 ? ' ON POINTS' : ''}: +${b.xp[b.winner]} XP, ${ds[1 - b.winner].name} +${b.xp[1 - b.winner]} XP`);
  if (b.log.length > LOG_MAX) b.log.splice(0, b.log.length - LOG_MAX);
  sim.events.push({ kind: 'boutEnd', dragons: [ds[0].id, ds[1].id], winner: b.winner == null ? null : ds[b.winner].id, xp: [b.xp[0], b.xp[1]] });
  ds.forEach((d, i) => {
    const was = levelOf(d.xp);
    d.xp += b.xp[i];
    const now = levelOf(d.xp);
    if (now > was) {
      sim.events.push({ kind: 'level', dragon: d.id, level: now });
      for (const s of learnedBetween(d.element, was, now)) sim.events.push({ kind: 'learn', dragon: d.id, skill: s.kind });
    }
    for (const k of ['food', 'sleep'] as const) if (hasNeed(d.element, k)) d.needs[k] = Math.min(d.needs[k], TIRED);
  });
  b.state = 'over'; b.t = 0;
}

/** How long a decided bout holds its two in the ring (`over`): the loser's lie-down, nap and wake, the winner's preen; a draw, both preen. */
export function overLen(sim: CareSim, b: Bout): number {
  return Math.max(...b.fighters.map((f, i) => {
    const d = dragonOf(sim, f.dragon);
    return b.winner != null && b.winner !== i ? napLen(d) + animLen(d.element, d.stage, 'wake') : animLen(d.element, d.stage, 'happy');
  })) + MOVE_GAP;
}
/** The loser's nap: its lie-down (the sleep's intro), then NAP_STEPS asleep. */
function napLen(d: Dragon): number { return animLen(d.element, d.stage, 'sleep', true) + NAP_STEPS; }

/** The muster: each fighter to its corner (the east one first up), then facing the other. Both there: a beat, and the first turn. */
function stepMuster(sim: CareSim, b: Bout): void {
  for (const f of b.fighters) {
    const d = dragonOf(sim, f.dragon);
    // (a job re-queued since the start -- a Rush -- is dropped again; one a keeper is at work on is finished first)
    if (sim.jobs.some((j) => j.dragon === d && j.keeper?.phase !== 'work')) leaveBarn(sim, d);
    // (its slot is let go as it sets off: met to the end of a job under way, or asleep, it keeps its place till then)
    if (d.slot && mayGo(sim, d)) d.slot = null;
    // (on the roof, off the car: its corner -- the east one while it is free, so the second up never walks through the first)
    if (f.corner == null && d.f === AERIE_F && d.move !== 'ride' && d.move !== 'board' && d.move !== 'call') f.corner = b.fighters.some((o) => o.corner === 1) ? 0 : 1;
    const x = arenaSpot(d.stage, f.corner ?? 1);
    dragonTo(sim, d, AERIE_F, x);
    if (f.corner != null && standsAt(d, AERIE_F, x)) faceWay(d, f.corner === 0 ? 1 : -1);
  }
  const ready = b.fighters.every((f) => {
    const d = dragonOf(sim, f.dragon);
    return f.corner != null && standsAt(d, AERIE_F, arenaSpot(d.stage, f.corner)) && d.facing === (f.corner === 0 ? 1 : -1);
  });
  if (!ready) return;
  b.state = 'face'; b.t = 0;
  sim.use('arena');
  const [a, c] = b.fighters.map((f) => dragonOf(sim, f.dragon));
  b.log.push(`${a.name} (LV ${b.fighters[0].level}) AND ${c.name} (LV ${b.fighters[1].level}) FACE EACH OTHER`);
}

/** A turn's moves, one after the other; a fighter out of puff ends the bout, as does the last turn's end. */
function stepPlay(sim: CareSim, b: Bout): void {
  const m = b.moves[b.cur];
  m.t++;
  if (m.t === m.at) land(sim, b, m);
  if (m.t < m.len + MOVE_GAP) return;
  if (b.fighters.some((f) => f.puff <= 0)) { decide(sim, b); return; }
  if (++b.cur < b.moves.length) return;
  if (b.turn >= MAX_TURNS) { decide(sim, b); return; }
  b.state = 'pick'; b.t = 0;
}

/** Home: the west corner sets off for the nearest free slot of its size, the east one HOME_GAP later; the bout is over once both are off the Arena deck. */
function stepHome(sim: CareSim, b: Bout): void {
  const sendHome = (f: Fighter) => {
    const d = dragonOf(sim, f.dragon);
    if (d.goal !== 'bout') return;
    d.goal = null;
    const slot = nearestFree(sim, d, d.stage, ['hatchery']);
    if (slot) { d.goal = 'settle'; sendTo(sim, d, slot); raiseCall(sim, d); }
  };
  const byCorner = b.fighters.slice().sort((x, y) => (x.corner ?? 0) - (y.corner ?? 0));
  if (b.t === 1) sendHome(byCorner[0]);
  if (b.t === 1 + HOME_GAP) sendHome(byCorner[1]);
  const gone = b.t > 1 + HOME_GAP && b.fighters.every((f) => { const d = dragonOf(sim, f.dragon); return d.f !== AERIE_F || d.x < ARENA_X0; });
  if (gone) sim.arena.bout = null;
}

/** The arena's half of a step (after the missions'): the bout on, if any, steps on. */
export function stepArena(sim: CareSim): void {
  const b = sim.arena.bout;
  if (!b) return;
  b.t++;
  switch (b.state) {
    case 'muster': stepMuster(sim, b); break;
    case 'face': if (b.t >= FACE_STEPS) { b.state = 'pick'; b.t = 0; } break;
    case 'pick': if (b.auto || b.pick || b.t >= PICK_WAIT) beginTurn(sim, b); break;
    case 'play': stepPlay(sim, b); break;
    case 'over': if (b.t >= overLen(sim, b)) { b.state = 'home'; b.t = 0; } break;
    case 'home': stepHome(sim, b); break;
  }
}

// ---------- for the lift, the view and the save ----------

/** Whether a dragon's lift call is a bout's (a fighter going up to its corner, or walking home after): the car's first priority, as a mission's team's. */
export function boutCall(sim: CareSim, d: Dragon): boolean {
  const b = sim.arena.bout;
  return d.goal === 'bout' || (!!b && b.state === 'home' && d.goal === 'settle' && b.fighters.some((f) => f.dragon === d.id));
}

/** A fighter's index in the bout on (0 the player's, 1 the partner), or -1. */
export function fighterIndex(sim: CareSim, d: Dragon): -1 | 0 | 1 {
  const b = sim.arena.bout;
  return !b ? -1 : b.fighters[0].dragon === d.id ? 0 : b.fighters[1].dragon === d.id ? 1 : -1;
}

/** A look's key: new for every move of every bout, and for a bout's nap and preen (the view restarts an anim on a new key). */
const lookKey = (b: Bout, n: number) => b.id * 100 + n;

/** The face a landed move leaves on the one it landed on (null: none -- a preen is its own mover's business). */
function faceOf(m: Move): DFaceName | null {
  if (m.skill === 'preen') return null;
  if (m.skill === 'yawn') return m.moved ? 'sleepy' : null;
  return m.hit ? 'surprised' : 'happy';
}

/**
 * What a fighter shows now (the view plays it: BASE_DESIGN 10), or null for the view's own choice (walking, standing,
 * turning, idling): during a move, its mover plays the skill's anim from the move's first step to its last (`key`, new
 * each move, restarts it) and the other shows a face once the move has landed on it -- `surprised` hit, `happy`
 * dodging, `sleepy` catching a yawn -- for FACE_FRAMES; decided, the one out of puff lies down and naps (then the view
 * plays its wake, as for any sleeper: base.ts sync), and the winner preens once (a draw: both).
 */
export function boutLook(sim: CareSim, d: Dragon): { anim: string | null; key: number; face: DFaceName | null } | null {
  const b = sim.arena.bout, i = fighterIndex(sim, d);
  if (!b || i < 0) return null;
  if (b.state === 'play') {
    const m = b.moves[b.cur];
    if (m.by === i) return m.t < m.len ? { anim: skillOf(d.element, m.skill).anim, key: lookKey(b, b.turn * 2 + m.n), face: null } : null;
    const face = m.landed && m.t - m.at < FACE_FRAMES ? faceOf(m) : null;
    return face ? { anim: null, key: -1, face } : null;
  }
  if (b.state === 'over') {
    if (b.winner != null && b.winner !== i) return b.t < napLen(d) ? { anim: 'sleep', key: lookKey(b, 98), face: null } : null;
    return b.t < animLen(d.element, d.stage, 'happy') ? { anim: 'happy', key: lookKey(b, 99), face: null } : null;
  }
  return null;
}

/** The arena's state as the save keeps it: a deep copy (plain JSON: every reference an id already). */
export function copyArena(a: ArenaState): ArenaState { return JSON.parse(JSON.stringify(a)) as ArenaState; }

/**
 * A save's arena, checked and copied (CareSim.fromSave): a count, and a bout this build can run -- two different dragons
 * the save has, in a state it knows, with whole numbers where it counts (puff 0..its whole, stages -2..2, corners
 * apart), moves of skills it knows -- else it throws, and the view starts a new barn (base.ts load).
 */
export function checkArena(raw: unknown, dragons: readonly { id: number }[]): ArenaState {
  const bad = (why: string): never => { throw new Error(`save: the arena ${why}`); };
  if (!raw || typeof raw !== 'object') bad('is missing');
  const a = raw as ArenaState, whole = (v: unknown, min = 0) => Number.isInteger(v) && (v as number) >= min;
  if (!whole(a.bouts)) bad(`count (${JSON.stringify(a.bouts)}) is not one`);
  const b = a.bout;
  if (b !== null) {
    const stage = (v: unknown) => Number.isInteger(v) && (v as number) >= STAGE_MIN && (v as number) <= STAGE_MAX;
    const fighter = (f: Fighter) => f && typeof f === 'object' && dragons.some((d) => d.id === f.dragon) && (f.corner === null || f.corner === 0 || f.corner === 1)
      && whole(f.level, 1) && f.stats && ['puff', 'power', 'guard', 'speed'].every((k) => whole(f.stats[k as keyof Stats], 1)) && whole(f.puff) && f.puff <= f.stats.puff
      && stage(f.power) && stage(f.guard) && stage(f.speed);
    const move = (m: Move) => m && typeof m === 'object' && (m.by === 0 || m.by === 1) && (m.n === 0 || m.n === 1) && SKILL_KINDS.includes(m.skill)
      && whole(m.t) && whole(m.len, 1) && whole(m.at, 1) && typeof m.landed === 'boolean' && typeof m.hit === 'boolean' && whole(m.loss);
    if (!b || typeof b !== 'object' || !whole(b.id) || b.id >= a.bouts || !Array.isArray(b.fighters) || b.fighters.length !== 2 || !b.fighters.every(fighter)
      || b.fighters[0].dragon === b.fighters[1].dragon || (b.fighters[0].corner != null && b.fighters[0].corner === b.fighters[1].corner)
      || !BOUT_STATES.includes(b.state) || !whole(b.t) || !whole(b.turn) || b.turn > MAX_TURNS || typeof b.auto !== 'boolean' || (b.pick !== null && !SKILL_KINDS.includes(b.pick))
      || !Array.isArray(b.moves) || b.moves.length > 2 || !b.moves.every(move) || !whole(b.cur) || (b.state === 'play' && b.cur >= b.moves.length)
      || !(b.winner === null || b.winner === 0 || b.winner === 1) || !Array.isArray(b.xp) || b.xp.length !== 2 || !b.xp.every((x) => whole(x))
      || !Array.isArray(b.log) || !b.log.every((l) => typeof l === 'string')) bad(`bout (${JSON.stringify({ state: b?.state, fighters: b?.fighters?.map?.((f) => f?.dragon) })}) is not one this build can run`);
  }
  return copyArena(a);
}
