// Encounters on the road (docs/BASE_DESIGN.md 11): what a mission's team does at each stop of its road, played turn by
// turn like the Arena's bouts (10), fought but never wounding (B8). A stop is an OBSTACLE -- one of the eleven
// challenges: the land's (pitch dark, a heavy load, the cold, a storm, a spring flood, thorns, lost things) or the
// people's (the grumpy miller, a hurt animal, thick fog, a narrow gap) -- a CHECK with a MARK to beat, or a FIGHT: with
// a pack of the region's little enemies between the challenges (every road has some: missions.ts roadOf), or with the
// region's boss at every road's end. An enemy has PUFF to wear down, never health: a pack worn out goes up in puffs of
// smoke, one of them for each share of its puff, and a boss worn out sits down seeing stars and runs off; one the team
// can't wear out leaves anyway (a pack scampers off, a boss stomps off unbeaten), and the team walks on.
//
// Each turn every pair acts: the player picks its dragon's ability -- a skill from the Arena's own menu (its breath,
// its show-off, PREEN, YAWN: training.ts), REST (a breather: puff back), or, once a stop, its rider's special where the
// rider's skill is the stop's counter (the CHARM that talks the miller round, the MEDIC's bandage, the NAVIGATOR's way
// through the fog, the NIMBLE slip through the gap; and on a boss, its counter skill) -- or
// the trail coach picks (AUTO on, or once a pick has waited PICK_WAIT_TRAIL with nobody watching: the view makes the
// world wait while its menu is up, so the wait runs out only with the team left on its own). The quicker moves first;
// each move is its dragon's own anim (or its rider's moment), played through while the team stands at the stop, and
// lands at its impact (in a fight a breath is thrown: its bolt lands, as an enemy's missile does).
//
// An obstacle is a skill check, not a fight: a dragon's move is a TRY at it -- a roll of a d20 (1 to SIDES) plus the move's
// BONUS (the skill's power weighed by the dragon's POWER, STRONG (x2) for the element that meets the challenge
// (BASE_DESIGN 5.3's table: water and the flood, dusk and the dark...), else it HELPS (x1) on a land stop and a little
// (x0.4) on the miller and the hurt animal, whom a show-off CHARMS (x1.5)) against the stop's MARK (by the road's
// difficulty): a score at the mark or over PASSES and clears the stop at once (a 20 always does, a 1 never), a lower one
// FALLS SHORT; the menu says each try's chance. The rider's special clears it outright, no roll. Every turn the obstacle
// still stands, it BITES: each pair's dragon with puff left loses BITE puff (the cold bites, the flood soaks), and the
// mark EASES by MARK_EASE (the team gets its measure). The team waits it out after MAX_OBSTACLE_TURNS tries, or when
// every dragon is out of puff.
// A fight: the team's moves cost the enemy puff as a bout's cost the other dragon (training.ts's cost, STRONG for the
// boss's counter element; a pack has none: every element even on it), the rider's special on a boss a quarter of its
// whole puff and its POWER down a stage; the enemy's coach picks one of its three moves a turn (an attack on one pair's
// dragon -- its region's missile thrown -- a grumble that puts that dragon's POWER down, a rest: a boss's only) and it
// leaves when it is out of puff -- or when every dragon is, or after MAX_FIGHT_TURNS: it always leaves, worn out or not,
// and the team walks on (5.5). A boss's stats are its road's difficulty's share of its own (FOE_SCALE); a pack's are its
// kind's, times its size (the mission's `pack`). A dragon out of puff sits the rest of the stop out. Puff is carried along the
// whole road (a hard fight at the end of a tiring road), with a rest on the walk between stops (WALK_REST); every stop
// brings XP (training.ts levels, the Arena's skills).
//
// DOM-free and deterministic: every roll a stateless rngAt(seed, TRIP, mission, stop, turn, k); the whole state plain
// data the save keeps with the trip (trip.ts Trip.encounter). The trail coach's dry run of a road (forecastRoad) uses
// the same rules with the rolls fixed: the chooser's FORECAST and BEST TEAM read it. Nothing here reads the day's phase.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { DFaceName } from '../art/dragon/pose.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import { rngAt, TAG } from './rand.ts';
import { animLen } from './gait.ts';
import { CHALLENGES, BADDIES, FOES, KEEPER_SKILL, SKILL_NAME } from './regions.ts';
import type { Counter } from './regions.ts';
import type { BaddieId, BaddieFace, FoeId, Difficulty, Skill as RiderSkill } from './missiondata.ts';
import { statsOf, spirits, skillsOf, skillOf, stageMult, levelOf, learnedBetween, LOSS_SCALE, STRONG, STAGE_MIN, STAGE_MAX } from './training.ts';
import type { Stats, SkillKind, Skill } from './training.ts';
import type { Mission, Pair, Stop, Trip } from './trip.ts';
import type { CareSim, Dragon, Keeper } from './sim.ts';
import { OWN_NEED } from './needs.ts';

// ---------- the state ----------

/** What a pair can do in a turn: one of its dragon's Arena skills, REST (a breather), or its rider's special (once a stop). */
export type Ability = SkillKind | 'rest' | 'rider';
export const ABILITIES: readonly Ability[] = Object.freeze(['breath', 'big', 'show', 'preen', 'yawn', 'rest', 'rider'] as Ability[]);
/** A pair's pick for the turn: an ability, or `sit` (out of puff: it does nothing). */
export type Pick = Ability | 'sit';
export type EncounterKind = 'obstacle' | 'fight';
/** An encounter's state: the team meets the stop (a fight: the enemy walks in); the picks wait; the turn's moves play; resolved (an obstacle's beat, a fight's exit), then the trip walks on. */
export type EncounterState = 'meet' | 'pick' | 'play' | 'done';
export const ENCOUNTER_STATES: readonly EncounterState[] = Object.freeze(['meet', 'pick', 'play', 'done'] as EncounterState[]);
/** The enemy's three moves: an attack on one dragon (puff: its region's missile thrown), a grumble (that dragon's POWER down), a rest (a boss's own puff back). */
export type FoeMoveKind = 'attack' | 'grumble' | 'rest';
export const FOE_MOVE_KINDS: readonly FoeMoveKind[] = Object.freeze(['attack', 'grumble', 'rest'] as FoeMoveKind[]);
/** The enemy's index among the movers (a pair's is 0 or 1). */
export const FOE = -1;

/**
 * The enemy in a fight: which -- a boss, or a pack of a region's little enemies -- its stats (a pack's: its whole
 * pack's puff), the puff it has left, its stats' stages this fight, and (a pack) how many it began with.
 */
export interface Foe { id: BaddieId | FoeId; stats: Stats; puff: number; power: number; guard: number; pack: number }

/**
 * A move in a turn: whose (a pair's index, or FOE), what (a pair's pick, or the enemy's move and the pair it is at),
 * its place in the turn, the steps it has played, its length and the step it lands at; and once landed, whether it
 * hit (a fight) or passed (an obstacle's check), the puff it cost (a fight), its roll and its score (an obstacle: the
 * roll plus the bonus; 0 when it rolled nothing), the puff it gave back (a rest) and the stage it moved.
 */
export interface EMove {
  by: number;
  ability: Pick | null;
  foeMove: FoeMoveKind | null;
  target: number;
  n: number;
  t: number;
  len: number;
  at: number;
  landed: boolean;
  hit: boolean;
  loss: number;
  roll: number;
  score: number;
  gain: number;
  moved: { who: number; stat: 'power' | 'guard'; by: number } | null;
}

/**
 * An encounter at a stop: its stop's index on the road, its kind, state and the steps in it, the turns begun, this
 * turn's picks (one a pair; null while waited for) and moves (the one playing: `cur`), an obstacle's mark as the stop
 * began and as it stands now (eased by tries that fell short), a fight's enemy (boss or pack), each pair's POWER and GUARD
 * stages, whether each pair's rider special is still to be had, the outcome once resolved, and its lines (the latest
 * last).
 */
export interface Encounter {
  stop: number;
  kind: EncounterKind;
  state: EncounterState;
  t: number;
  turn: number;
  picks: (Pick | null)[];
  moves: EMove[];
  cur: number;
  mark0: number;
  mark: number;
  foe: Foe | null;
  power: number[];
  guard: number[];
  special: boolean[];
  outcome: 'cleared' | 'waited' | null;
  log: string[];
}

// ---------- numbers (BASE_DESIGN 11) ----------

/**
 * An obstacle's mark to beat by the road's difficulty; the sides of the d20 a try rolls (1 to SIDES); how much the mark
 * eases after a turn that fell short; the puff each dragon loses every turn it stands; what a REST gives back; the POWER
 * a try's bonus is read against (a LV 1 adult's, about). A young adult's breath STRONG on its stop (bonus about 20)
 * passes an easy mark 95 times in 100, a hard one 75; one that merely helps (about 12) passes an easy one 55 times in
 * 100, a hard one 25 on its first try and 65 on its third; a breath at the miller or the bird (about 5) is a long shot.
 */
export const MARK: Readonly<Record<Difficulty, number>> = Object.freeze({ easy: 22, normal: 25, hard: 28 });
export const SIDES = 20, MARK_EASE = 4;
export const BITE = 3, REST_GAIN = 8, BONUS_BASE = 12;
/** An ability's weight on a try's bonus: the element that meets the challenge; any other element on a land stop; on a people stop, an element (a little) and a show-off (it charms). */
export const CHECK_STRONG = 2, CHECK_HELP = 1, CHECK_LITTLE = 0.4, CHECK_CHARM = 1.5;
/** The rider's special in a fight: this share of the baddie's whole puff, and its POWER down a stage. */
export const FOE_SPECIAL = 0.25;
/**
 * Steps: the team meets an obstacle (its banner), an enemy walks in (the riders step back behind their dragons
 * meanwhile: missionview.ts); a REST and a rider's special play; the enemy's move (its missile leaves its hand at
 * FOE_THROW and lands at FOE_IMPACT); between moves; an obstacle's resolution beat, a pack's, and a boss's exit beat (down
 * seeing stars, then off up the road).
 */
export const MEET_STEPS = 60, FOE_ENTER = 160, REST_STEPS = 90, RIDER_STEPS = 90, FOE_MOVE_STEPS = 72, FOE_THROW = 18, FOE_IMPACT = 48, MOVE_GAP = 24, DONE_STEPS = 90, PACK_EXIT = 120, EXIT_STEPS = 360;
/** In a fight a breath is thrown: its bolt leaves the mouth at the breath's snap (its cue, BREATH_SNAP steps in, on every stage) and lands BOLT_STEPS later. */
export const BREATH_SNAP = 22, BOLT_STEPS = 30;
/** The player's pick waits this long for them (7.5 s at 1x; nobody watching: the view makes the world wait while its menu is up), then the trail coach picks. */
export const PICK_WAIT_TRAIL = 450;
/** The turns a stop lasts at most: an obstacle's tries, then the team waits it out; a fight's, then the team sits down for a breather while the baddie leaves. */
export const MAX_OBSTACLE_TURNS = 3, MAX_FIGHT_TURNS = 12;
/** The walk between stops gives each dragon back this share of its whole puff (at the next stop's start). */
export const WALK_REST = 0.3;
/** What a stop brings each pair's dragon: an obstacle cleared or waited out, a boss's fight won or not, a pack's. */
export const XP_ROAD = Object.freeze({ cleared: 15, waited: 5, won: 40, lost: 15, pack: 8, packLost: 3 });
/** How long the one a move landed on shows its face (surprised, or a dodge's grin), steps. */
export const FACE_FRAMES = 36;
/** A REST plays the sit (`beg`: the dragon sits down for a breather), a rider's special the rider's own moment (missionview.ts RIDER_MOMENT). */
export const REST_ANIM = 'beg';
/**
 * The bosses in a fight (BASE_DESIGN 5.3, 11), at a hard road's end: their stats -- the Roc quick and light, the Giant
 * and the Golem slow and stout, the Troll and the Mole King in between, the Boar quick to charge -- and their three
 * moves' names (the attack is its region's missile: missionview.ts, fightfx.ts REGION_MISSILE).
 */
export const FOE_STATS: Readonly<Record<BaddieId, Readonly<Stats>>> = Object.freeze({
  bridgetroll: { puff: 100, power: 13, guard: 12, speed: 5 },
  moleking: { puff: 96, power: 12, guard: 12, speed: 6 },
  briarboar: { puff: 92, power: 14, guard: 11, speed: 12 },
  stormroc: { puff: 88, power: 13, guard: 10, speed: 16 },
  frostgiant: { puff: 104, power: 14, guard: 13, speed: 4 },
  cindergolem: { puff: 100, power: 13, guard: 13, speed: 3 },
});
/** A boss on an easier road: this share of its puff and its POWER (an easy road's boss is met by young dragons too). */
export const FOE_SCALE: Readonly<Record<Difficulty, number>> = Object.freeze({ easy: 0.5, normal: 0.75, hard: 1 });
/** One of a pack of little enemies (BASE_DESIGN 5.3): its stats -- a pack's puff is its size times this one's. */
export const PACK_STATS: Readonly<Record<FoeId, Readonly<Stats>>> = Object.freeze({
  mudgoblin: { puff: 10, power: 8, guard: 8, speed: 10 },
  moleminer: { puff: 11, power: 8, guard: 9, speed: 7 },
  thornsprite: { puff: 9, power: 9, guard: 8, speed: 12 },
  stormimp: { puff: 9, power: 9, guard: 7, speed: 14 },
  frostimp: { puff: 11, power: 8, guard: 9, speed: 8 },
  cinderimp: { puff: 10, power: 9, guard: 8, speed: 9 },
});
export const FOE_MOVES: Readonly<Record<BaddieId | FoeId, Readonly<Record<FoeMoveKind, string>>>> = Object.freeze({
  bridgetroll: { attack: 'CLOD TOSS', grumble: 'GROWL', rest: 'LEAN ON CLUB' },
  moleking: { attack: 'DIRT FLING', grumble: 'GRUMBLE', rest: 'SNUFFLE' },
  briarboar: { attack: 'BURR SHAKE', grumble: 'SNORT', rest: 'WALLOW' },
  stormroc: { attack: 'SKY ZAP', grumble: 'SCREECH', rest: 'PREEN' },
  frostgiant: { attack: 'SNOWBALL', grumble: 'COLD SIGH', rest: 'SHAKE OFF' },
  cindergolem: { attack: 'EMBER TOSS', grumble: 'RUMBLE', rest: 'SMOULDER' },
  mudgoblin: { attack: 'MUD FLING', grumble: 'JEER', rest: 'HUDDLE' },
  moleminer: { attack: 'PEBBLE TOSS', grumble: 'GRUMBLE', rest: 'HUDDLE' },
  thornsprite: { attack: 'BURR THROW', grumble: 'CACKLE', rest: 'HUDDLE' },
  stormimp: { attack: 'LITTLE ZAPS', grumble: 'CRACKLE', rest: 'HUDDLE' },
  frostimp: { attack: 'SNOWBALLS', grumble: 'TEASE', rest: 'HUDDLE' },
  cinderimp: { attack: 'EMBER TOSS', grumble: 'HISS', rest: 'HUDDLE' },
});
/** The enemy's attack (power, its chance to land) and a boss's rest (the puff back: a pack never rests). */
export const FOE_ATTACK = Object.freeze({ power: 12, acc: 0.9 }), FOE_REST_GAIN = 10;
/** The enemy's own words for each move landing (the line: `THE MOLE KING FLINGS DIRT: RIPPLE -9 PUFF`, `MUD GOBLINS FLING MUD: ...`). */
const FOE_VERBS: Readonly<Record<BaddieId | FoeId, Readonly<Record<FoeMoveKind, string>>>> = Object.freeze({
  bridgetroll: { attack: 'TOSSES A CLOD', grumble: 'GROWLS', rest: 'LEANS ON ITS CLUB' },
  moleking: { attack: 'FLINGS DIRT', grumble: 'GRUMBLES', rest: 'SNUFFLES' },
  briarboar: { attack: 'SHAKES A BURR OFF', grumble: 'SNORTS', rest: 'WALLOWS' },
  stormroc: { attack: 'SENDS DOWN A ZAP', grumble: 'SCREECHES', rest: 'PREENS' },
  frostgiant: { attack: 'LOBS A SNOWBALL', grumble: 'SIGHS A COLD SIGH', rest: 'SHAKES THE SNOW OFF' },
  cindergolem: { attack: 'TOSSES AN EMBER', grumble: 'RUMBLES', rest: 'SMOULDERS' },
  mudgoblin: { attack: 'FLING MUD', grumble: 'JEER', rest: 'HUDDLE' },
  moleminer: { attack: 'TOSS PEBBLES', grumble: 'GRUMBLE', rest: 'HUDDLE' },
  thornsprite: { attack: 'THROW BURRS', grumble: 'CACKLE', rest: 'HUDDLE' },
  stormimp: { attack: 'SEND LITTLE ZAPS', grumble: 'CRACKLE', rest: 'HUDDLE' },
  frostimp: { attack: 'THROW SNOWBALLS', grumble: 'TEASE', rest: 'HUDDLE' },
  cinderimp: { attack: 'TOSS EMBERS', grumble: 'HISS', rest: 'HUDDLE' },
});
/** Whether an enemy is a pack of little enemies (else a boss). */
export const isPack = (id: BaddieId | FoeId): id is FoeId => id in PACK_STATS;
/** An enemy's name (a boss's own, a pack's kind's) and its short word. */
export const foeName = (id: BaddieId | FoeId): string => (isPack(id) ? FOES[id].name : BADDIES[id].name);
export const foeWord = (id: BaddieId | FoeId): string => (isPack(id) ? FOES[id].word : BADDIES[id].word);
/** How a pick is written on the menu and in the lines. */
export const ABILITY_NAME: Readonly<Record<'rest' | 'rider' | 'sit', string>> = Object.freeze({ rest: 'REST', rider: 'SPECIAL', sit: 'SITS IT OUT' });

// ---------- the team as the rules see it ----------

/** A pair as the rules see it: its dragon's name, element, stage, level and stats (its spirits on its power, fixed at the send), and its rider. */
export interface Member { name: string; el: DragonElement; stage: Stage; level: number; stats: Readonly<Stats>; rider: KeeperId; riderName: string }
/** The team at a stop: its members, and each one's puff (the trip's own array: what a stop costs stays cost). */
export interface Party { members: Member[]; puff: number[] }

/** A pair of partners (the keeper whose specialty is the dragon's element's own need: missions.ts partnerOf) has this much more POWER on the road. */
export const PARTNER_POWER = 1.05;
/** Whether a dragon and its rider are partners (the rider's specialty its element's own need; water has no partner). */
export function partnerPair(d: Dragon, k: Keeper): boolean { return k.specialty === OWN_NEED[d.element]; }

/**
 * A dragon's stats for a trip: its Arena stats at its stage and level, its spirits on its power (training.ts spirits:
 * happy dragons work harder), and PARTNER_POWER on it when its rider is its partner.
 */
export function tripStats(el: DragonElement, stage: Stage, xp: number, mood: number, partners = false): Stats {
  const s = statsOf(el, stage, levelOf(xp));
  return { ...s, power: Math.max(1, Math.round(s.power * spirits(mood) * (partners ? PARTNER_POWER : 1))) };
}

/** The team out as the rules see it (the trip's pairs, stats and puff). */
export function partyOf(sim: CareSim, trip: Trip): Party {
  const members = trip.pairs.map((p, i): Member => {
    const d = sim.dragons.find((q) => q.id === p.dragon), k = sim.keepers.find((q) => q.id === p.keeper);
    if (!d || !k) throw new Error(`encounter: pair ${i} is nobody's`);
    return { name: d.name, el: d.element, stage: d.stage, level: levelOf(d.xp), stats: trip.stats[i], rider: k.look, riderName: k.name };
  });
  return { members, puff: trip.puff };
}

// ---------- what a stop is ----------

/** A stop's counter (regions.ts): the challenge's, a boss's two (its element, its skill), or none (a pack: every element even on it). */
function counterOf(stop: Stop): Counter[] {
  return stop.kind === 'baddie' ? [...BADDIES[stop.baddie!].counters] : stop.kind === 'foes' ? [] : [CHALLENGES[stop.challenge!].counter];
}
/** The element that meets a stop (null: a people stop), and the rider's skill that does (null: a land stop). */
export function stopElement(stop: Stop): DragonElement | null { return counterOf(stop).find((c) => c.element)?.element ?? null; }
export function stopSkill(stop: Stop): RiderSkill | null { return counterOf(stop).find((c) => c.skill)?.skill ?? null; }
/** A stop's enemy (a fight's), or null: an obstacle. */
export function stopFoe(stop: Stop): BaddieId | FoeId | null { return stop.kind === 'baddie' ? stop.baddie : stop.kind === 'foes' ? stop.foe : null; }
/** A stop's name: the challenge's, the pack's or the boss's. */
export function stopName(stop: Stop): string { const f = stopFoe(stop); return f ? foeName(f) : CHALLENGES[stop.challenge!].name; }
/** A stop's short word (the chip): the challenge's, the pack's or the boss's. */
export function stopWord(stop: Stop): string { const f = stopFoe(stop); return f ? foeWord(f) : CHALLENGES[stop.challenge!].word; }
/** Whether a stop is one a rider's skill meets (the miller, the hurt animal, the fog, the gap). */
export function riderStop(stop: Stop): boolean { return stop.kind === 'challenge' && !!CHALLENGES[stop.challenge!].counter.skill; }
/** Whether a stop is somebody a dragon's show-off charms (the grumpy miller, the hurt animal), where a breath does little. */
export function charmStop(stop: Stop): boolean { return stop.kind === 'challenge' && !!CHALLENGES[stop.challenge!].charmed; }

// ---------- what an ability does here ----------

/**
 * An ability on the menu at this stop for pair i (BASE_DESIGN 11): its name, its line (what it is), its note (how it
 * lands here), its weight on the try's bonus or the cost (0 for a status skill, a rest or the special), its power and
 * accuracy, at an obstacle its bonus to the roll and its chance of passing the check (0..1; 1 for the special, which
 * rolls nothing), the anim it plays, and the skill behind it (null for a rest or the special).
 */
export interface Offer { ability: Ability; name: string; what: string; note: string; weight: number; power: number; acc: number; bonus: number; chance: number; anim: string; skill: Skill | null }

/** How a move's weight reads: STRONG, EVEN or a little. */
const weightWord = (w: number, on: string) => (w > 1 ? `STRONG ON ${on}!` : w < 1 ? `HELPS A LITTLE` : on ? `EVEN ON ${on}` : 'HELPS');

// ---------- the check ----------

/** A try's roll from one roll u in [0, 1): 1 to SIDES (the forecast's even roll is 11). */
export function rollOf(u: number): number { return Math.max(1, Math.min(SIDES, Math.floor(u * SIDES) + 1)); }
/** A try's bonus: the skill's power weighed by the dragon's POWER (at its stage) over BONUS_BASE and the ability's weight here, a whole number, at least 1. */
export function bonusOf(power: number, myPower: number, w: number): number { return Math.max(1, Math.round(power * (myPower / BONUS_BASE) * w)); }
/** Whether a try passes the mark: a 20 always does, a 1 never, else its score (the roll plus the bonus) at the mark or over. */
export function passes(roll: number, bonus: number, mark: number): boolean { return roll >= SIDES ? true : roll <= 1 ? false : roll + bonus >= mark; }
/** The chance a try with this bonus passes this mark: the rolls of the SIDES that pass, over SIDES (so 5 % to 95 %). */
export function chanceOf(bonus: number, mark: number): number {
  let n = 0;
  for (let r = 1; r <= SIDES; r++) if (passes(r, bonus, mark)) n++;
  return n / SIDES;
}
/** A chance as the menu writes it (`80 %`). */
export const pct = (c: number) => `${Math.round(c * 100)} %`;

/**
 * The abilities pair i can pick at this stop, in the menu's order: its dragon's skills that do something here (an
 * obstacle takes no PREEN or YAWN: there is nobody to catch a yawn), REST, and its rider's special while it is to be had
 * and the rider's skill is the stop's counter.
 */
export function offersFor(enc: Encounter, party: Party, stop: Stop, i: number): Offer[] {
  const m = party.members[i], out: Offer[] = [], charm = charmStop(stop), el = stopElement(stop), fight = enc.kind === 'fight';
  const on = fight ? stopName(stop) : CHALLENGES[stop.challenge!].it;
  for (const s of skillsOf(m.el, m.level)) {
    if (s.type === 'status') {
      if (!fight) continue;
      out.push({ ability: s.kind, name: s.name, what: s.kind === 'preen' ? 'YOUR GUARD UP' : 'ITS POWER DOWN', note: s.kind === 'preen' ? (enc.guard[i] >= STAGE_MAX ? 'AS HIGH AS IT GOES' : 'HARDER TO TIRE') : (enc.foe!.power <= STAGE_MIN ? 'AS DROWSY AS IT GETS' : 'IT HITS SOFTER'), weight: 0, power: 0, acc: 1, bonus: 0, chance: 1, anim: s.anim, skill: s });
      continue;
    }
    // (the weight: in a fight the ring's -- the baddie's counter element is STRONG on it, the rest even, a show-off never
    // weak; at an obstacle the element that meets it x2, another element x1 (a little, x0.4, on somebody a breath can't
    // help: the miller, the bird), a show-off x0.4 (x1.5 on those two: it charms them))
    let w: number;
    if (fight) w = s.type === 'element' ? (m.el === el ? STRONG : 1) : 1;
    else if (s.type === 'element') w = m.el === el ? CHECK_STRONG : charm ? CHECK_LITTLE : CHECK_HELP;
    else w = charm ? CHECK_CHARM : CHECK_LITTLE;
    if (fight) {
      const what = `${s.type === 'element' ? '' : 'PLAIN - '}POWER ${s.power}${s.acc < 1 ? ` - ${Math.round(s.acc * 100)} %` : ''}`;
      out.push({ ability: s.kind, name: s.name, what, note: s.type === 'plain' ? 'NEVER WEAK' : weightWord(w, on), weight: w, power: s.power, acc: s.acc, bonus: 0, chance: s.acc, anim: s.anim, skill: s });
      continue;
    }
    // (a try at the check: the roll plus this bonus against the mark; the note says its chance and why)
    const bonus = bonusOf(s.power, m.stats.power * stageMult(enc.power[i]), w), chance = chanceOf(bonus, enc.mark);
    const how = s.type === 'plain' ? (charm ? `CHARMS ${on}` : 'HELPS A LITTLE') : w > 1 ? `STRONG ON ${on}!` : w < 1 ? 'HELPS A LITTLE' : 'HELPS';
    out.push({ ability: s.kind, name: s.name, what: `ROLL + ${bonus}`, note: `${pct(chance)}: ${how}`, weight: w, power: s.power, acc: 1, bonus, chance, anim: s.anim, skill: s });
  }
  out.push({ ability: 'rest', name: ABILITY_NAME.rest, what: 'A BREATHER', note: `+${REST_GAIN} PUFF`, weight: 0, power: 0, acc: 1, bonus: 0, chance: 0, anim: REST_ANIM, skill: null });
  const skill = stopSkill(stop);
  if (enc.special[i] && skill && KEEPER_SKILL[m.rider] === skill) {
    out.push({ ability: 'rider', name: `${m.riderName}: ${SKILL_NAME[skill]}`, what: 'ONCE A STOP', note: fight ? `-${Math.round(FOE_SPECIAL * 100)} % PUFF, POWER DOWN` : `NO ROLL: ${CHALLENGES[stop.challenge!].met}`, weight: 0, power: 0, acc: 1, bonus: 0, chance: 1, anim: 'rider', skill: null });
  }
  return out;
}

/** The offer for a pick, or null (an ability the pair hasn't got here). */
export function offerOf(enc: Encounter, party: Party, stop: Stop, i: number, ability: Ability): Offer | null {
  return offersFor(enc, party, stop, i).find((o) => o.ability === ability) ?? null;
}

// ---------- the rolls ----------

/** A source of rolls in [0, 1) by key: the live stop's stateless rngAt draws, or the forecast's fixed ones. */
export type Roll = (k: number) => number;
/** The live rolls for a turn of a stop: rngAt(seed, TRIP, mission, stop, turn, k). */
export const liveRoll = (seed: number, mission: number, stop: number, turn: number): Roll => (k) => rngAt(seed, TAG.TRIP, mission, stop, turn, k).next();
/** The forecast's rolls: every move lands with its middling spread, the coaches never gamble. */
export const evenRoll: Roll = () => 0.5;

// ---------- a stop begins ----------

/**
 * An enemy's stats on a road of this difficulty: a boss's, its puff and POWER at FOE_SCALE of its own; a pack's, its
 * kind's, its puff times its size.
 */
export function foeStats(id: BaddieId | FoeId, difficulty: Difficulty, pack: number): Stats {
  if (isPack(id)) { const s = PACK_STATS[id]; return { ...s, puff: s.puff * Math.max(1, pack) }; }
  const s = FOE_STATS[id], k = FOE_SCALE[difficulty];
  return { ...s, puff: Math.round(s.puff * k), power: Math.max(1, Math.round(s.power * (0.6 + 0.4 * k))) };
}

/** A new encounter at stop j of the road (the trip's team having rested WALK_REST on the walk: partyOf applies it). */
export function newEncounter(trip: Trip, j: number): Encounter {
  const stop = trip.stops[j], id = stopFoe(stop), fight = id != null, n = trip.pairs.length, mark = MARK[trip.mission.difficulty];
  const pack = stop.kind === 'foes' ? Math.max(1, trip.mission.pack || 1) : 1, stats = id ? foeStats(id, trip.mission.difficulty, pack) : null;
  const foe: Foe | null = id && stats ? { id, stats, puff: stats.puff, power: 0, guard: 0, pack } : null;
  return { stop: j, kind: fight ? 'fight' : 'obstacle', state: 'meet', t: 0, turn: 0, picks: trip.pairs.map(() => null), moves: [], cur: 0,
    mark0: fight ? 0 : mark, mark: fight ? 0 : mark, foe, power: Array(n).fill(0), guard: Array(n).fill(0), special: Array(n).fill(true), outcome: null, log: [] };
}

/** The line a stop opens with. */
export function meetLine(enc: Encounter, stop: Stop): string {
  if (enc.kind === 'fight') return `${stopName(stop)}! ${enc.foe!.stats.puff} PUFF TO WEAR ${stop.kind === 'foes' ? 'THEM' : 'IT'} OUT`;
  return `${stopName(stop)} AHEAD: BEAT ${enc.mark} TO ${CHALLENGES[stop.challenge!].clear}`;
}
/** The try a stop is on (1 to MAX_OBSTACLE_TURNS): the turn playing, or the one whose picks wait. */
export function tryOf(enc: Encounter): number { return Math.min(MAX_OBSTACLE_TURNS, enc.state === 'play' || enc.state === 'done' ? Math.max(1, enc.turn) : enc.turn + 1); }

/** The walk to a stop gives each dragon back WALK_REST of its whole puff. */
export function walkRest(party: Party): void {
  party.members.forEach((m, i) => { party.puff[i] = Math.min(m.stats.puff, party.puff[i] + Math.round(WALK_REST * m.stats.puff)); });
}

// ---------- the coaches ----------

/** Whether a pair has puff to act with. */
const canAct = (party: Party, i: number) => party.puff[i] > 0;

/**
 * The trail coach's pick for pair i (a pick left to it, or AUTO), from one roll u: the rider's special whenever it is
 * to be had (it clears an obstacle, and opens a fight); a REST when low (under a fifth of its puff at an obstacle, under
 * three tenths in a fight, two rolls in five); in a fight, a YAWN early while the baddie's POWER can still go down (one
 * roll in seven, the first three turns) and a PREEN while fresh (one in seven); else, in a fight, the move that does
 * most on average (its power x its chance x its weight), and at an obstacle the try with the best chance.
 */
export function coachPick(enc: Encounter, party: Party, stop: Stop, i: number, u: number): Pick {
  if (!canAct(party, i)) return 'sit';
  const offers = offersFor(enc, party, stop, i), has = (a: Ability) => offers.some((o) => o.ability === a);
  if (has('rider')) return 'rider';
  const share = party.puff[i] / party.members[i].stats.puff, fight = enc.kind === 'fight';
  if (share < (fight ? 0.3 : 0.2) && u < 0.4) return 'rest';
  if (fight && has('yawn') && enc.turn <= 3 && enc.foe!.power > STAGE_MIN && u >= 0.4 && u < 0.55) return 'yawn';
  if (fight && has('preen') && share > 0.6 && enc.guard[i] < STAGE_MAX && u >= 0.55 && u < 0.7) return 'preen';
  let best: Offer | null = null, bestV = -1;
  for (const o of offers) {
    if (o.weight <= 0) continue;
    const v = fight ? o.power * o.acc * o.weight : o.chance + o.bonus / 1000;
    if (v > bestV) { bestV = v; best = o; }
  }
  return best ? best.ability : 'rest';
}

/**
 * The enemy's coach: a rest when a boss is low (under 35 % of its puff, three rolls in ten: a pack never rests), a
 * grumble early (the first three turns, one roll in four), else an attack; at the pair with puff left that roll v picks
 * (the forecast: the one with the most puff).
 */
export function foePick(enc: Encounter, party: Party, u: number, v: number, mostPuff = false): { move: FoeMoveKind; target: number } {
  const foe = enc.foe!, up = party.puff.map((p, i) => (p > 0 ? i : -1)).filter((i) => i >= 0);
  let target = up[0] ?? 0;
  if (mostPuff) { for (const i of up) if (party.puff[i] > party.puff[target]) target = i; }
  else target = up[Math.min(up.length - 1, Math.floor(v * up.length))] ?? 0;
  if (!isPack(foe.id) && foe.puff < 0.35 * foe.stats.puff && u < 0.3) return { move: 'rest', target: FOE };
  if (enc.turn <= 3 && u >= 0.5 && u < 0.75) return { move: 'grumble', target };
  return { move: 'attack', target };
}

// ---------- a turn ----------

/**
 * A move's length and impact: its dragon's anim (the skill's, or the sit) -- in a fight a breath lands when its bolt
 * does (BREATH_SNAP + BOLT_STEPS in, the anim held long enough) -- the rider's special, the enemy's (its missile thrown at
 * FOE_THROW, landing at FOE_IMPACT).
 */
function moveShape(fight: boolean, m: Member | null, pick: Pick | null, foeMove: FoeMoveKind | null): { len: number; at: number } {
  if (foeMove) return { len: FOE_MOVE_STEPS, at: FOE_IMPACT };
  if (pick === 'rest' || pick === 'sit') return { len: REST_STEPS, at: Math.round(REST_STEPS / 2) };
  if (pick === 'rider') return { len: RIDER_STEPS, at: Math.round(RIDER_STEPS / 2) };
  const s = skillOf(m!.el, pick as SkillKind), len = animLen(m!.el, m!.stage, s.anim);
  if (fight && s.anim === 'breath') { const at = BREATH_SNAP + BOLT_STEPS; return { len: Math.max(len, at + 12), at }; }
  return { len, at: Math.max(1, Math.round(len * s.impact)) };
}

/**
 * A turn begins: every pair's pick (a pair out of puff sits it out) and, in a fight, the enemy's move, the quicker
 * first (SPEED: a pair's dragon's, the enemy's; a pair before the enemy on a tie, the lower pair first). The turn's
 * number counts from 1.
 */
export function beginTurn(enc: Encounter, party: Party, roll: Roll, mostPuff = false): void {
  enc.turn++;
  const movers: { by: number; pick: Pick | null; foeMove: FoeMoveKind | null; target: number; speed: number }[] = [];
  party.members.forEach((m, i) => {
    const pick = canAct(party, i) ? enc.picks[i] ?? 'sit' : 'sit';
    movers.push({ by: i, pick, foeMove: null, target: FOE, speed: m.stats.speed });
  });
  if (enc.kind === 'fight') {
    const f = foePick(enc, party, roll(10), roll(11), mostPuff);
    movers.push({ by: FOE, pick: null, foeMove: f.move, target: f.target, speed: enc.foe!.stats.speed });
  }
  movers.sort((a, b) => b.speed - a.speed || (a.by === FOE ? 1 : b.by === FOE ? -1 : a.by - b.by));
  enc.moves = movers.map((v, n): EMove => {
    const shape = moveShape(enc.kind === 'fight', v.by === FOE ? null : party.members[v.by], v.pick, v.foeMove);
    return { by: v.by, ability: v.pick, foeMove: v.foeMove, target: v.target, n, t: 0, len: shape.len, at: shape.at, landed: false, hit: false, loss: 0, roll: 0, score: 0, gain: 0, moved: null };
  });
  enc.cur = 0; enc.state = 'play'; enc.t = 0;
  enc.picks = party.members.map(() => null);
}

/** Puff cost: an attack's `power` x (the attacker's POWER over the other's GUARD, each with its stage) x the weight x LOSS_SCALE x 85-100 % (the arena's cost), at least 1. */
function costOf(power: number, myPower: number, itsGuard: number, w: number, spread: number): number {
  return Math.max(1, Math.round(power * (myPower / itsGuard) * w * LOSS_SCALE * (0.85 + 0.15 * spread)));
}
/** A stage moved by `by` for a pair (or the enemy), within its limits; false if it was at its limit already. */
function moveStage(enc: Encounter, who: number, stat: 'power' | 'guard', by: number): boolean {
  const at = who === FOE ? enc.foe![stat] : enc[stat][who], to = Math.max(STAGE_MIN, Math.min(STAGE_MAX, at + by));
  if (to === at) return false;
  if (who === FOE) enc.foe![stat] = to; else enc[stat][who] = to;
  return true;
}
const push = (enc: Encounter, line: string) => { enc.log.push(line); if (enc.log.length > LOG_MAX) enc.log.splice(0, enc.log.length - LOG_MAX); };
/** An encounter's lines kept. */
export const LOG_MAX = 8;

/**
 * A move lands (at its impact): its rolls (k: the move's place in the turn, twice), the check or the cost, the puff
 * back, the stage moved; and its line. An obstacle passed or an enemy out of puff ends the turn there: the moves after
 * this one are dropped.
 */
export function landMove(enc: Encounter, party: Party, stop: Stop, m: EMove, roll: Roll): void {
  m.landed = true;
  const hitRoll = roll(20 + m.n * 2), spread = roll(21 + m.n * 2), foe = enc.foe;
  const them = foe ? foeName(foe.id) : '', many = !!foe && isPack(foe.id);
  if (m.by === FOE) {
    // the enemy's move
    const verb = FOE_VERBS[foe!.id][m.foeMove!];
    if (m.foeMove === 'rest') {
      m.hit = true; m.gain = Math.min(FOE_REST_GAIN, foe!.stats.puff - foe!.puff); foe!.puff += m.gain;
      push(enc, `${them} ${verb}: +${m.gain} PUFF`);
      return;
    }
    const i = m.target, t = party.members[i];
    if (!t || party.puff[i] <= 0) { m.hit = false; push(enc, `${them} ${verb} AT NOBODY`); return; }
    if (m.foeMove === 'grumble') {
      m.hit = true;
      if (moveStage(enc, i, 'power', -1)) { m.moved = { who: i, stat: 'power', by: -1 }; push(enc, `${them} ${verb}: ${t.name}'S POWER DOWN`); }
      else push(enc, `${them} ${verb}: ${t.name} IS AS DROWSY AS IT GETS`);
      return;
    }
    if (hitRoll >= FOE_ATTACK.acc) { m.hit = false; push(enc, `${them} ${verb}: ${t.name} DODGES!`); return; }
    m.hit = true;
    m.loss = Math.min(party.puff[i], costOf(FOE_ATTACK.power, foe!.stats.power * stageMult(foe!.power), t.stats.guard * stageMult(enc.guard[i]), 1, spread));
    party.puff[i] -= m.loss;
    push(enc, `${them} ${verb}: ${t.name} -${m.loss} PUFF${party.puff[i] <= 0 ? `. ${t.name} IS OUT OF PUFF AND SITS DOWN` : ''}`);
    return;
  }
  const i = m.by, me = party.members[i];
  if (m.ability === 'sit') { m.hit = false; return; }
  if (m.ability === 'rest') {
    m.hit = true; m.gain = Math.min(REST_GAIN, me.stats.puff - party.puff[i]); party.puff[i] += m.gain;
    push(enc, `${me.name} RESTS: +${m.gain} PUFF`);
    return;
  }
  if (m.ability === 'rider') {
    m.hit = true; enc.special[i] = false;
    if (enc.kind === 'fight') {
      m.loss = Math.min(foe!.puff, Math.round(FOE_SPECIAL * foe!.stats.puff)); foe!.puff -= m.loss;
      const down = moveStage(enc, FOE, 'power', -1);
      if (down) m.moved = { who: FOE, stat: 'power', by: -1 };
      push(enc, `${me.riderName} ${riderVerb(me.rider)} ${them}: -${m.loss} PUFF${down ? ', ITS POWER DOWN' : ''}`);
    } else {
      enc.mark = 0;
      push(enc, `${me.riderName} ${CHALLENGES[stop.challenge!].met}!`);
    }
    if ((enc.kind === 'obstacle' && enc.mark <= 0) || (foe && foe.puff <= 0)) enc.moves.splice(m.n + 1);
    return;
  }
  const o = offerOf(enc, party, stop, i, m.ability as Ability);
  const s = o?.skill ?? skillOf(me.el, m.ability as SkillKind);
  if (s.type === 'status') {
    m.hit = true;
    if (s.kind === 'preen') { const up = moveStage(enc, i, 'guard', 1); if (up) m.moved = { who: i, stat: 'guard', by: 1 }; push(enc, up ? `${me.name} PREENS: GUARD UP` : `${me.name} PREENS: ITS GUARD IS AS HIGH AS IT GOES`); }
    else { const down = moveStage(enc, FOE, 'power', -1); if (down) m.moved = { who: FOE, stat: 'power', by: -1 }; push(enc, down ? `${me.name} YAWNS AND ${them} ${many ? 'CATCH' : 'CATCHES'} IT: POWER DOWN` : `${me.name} YAWNS: ${them} ${many ? 'ARE AS DROWSY AS THEY GET' : 'IS AS DROWSY AS IT GETS'}`); }
    return;
  }
  const w = o?.weight ?? 1;
  if (enc.kind === 'fight') {
    const had = packLeft(foe!);
    if (hitRoll >= s.acc) { m.hit = false; push(enc, `${me.name}'S ${s.name} GOES WIDE`); return; }
    m.hit = true;
    m.loss = Math.min(foe!.puff, costOf(s.power, me.stats.power * stageMult(enc.power[i]), foe!.stats.guard * stageMult(foe!.guard), w, spread));
    foe!.puff -= m.loss;
    // (a pack: one of it goes up in a puff of smoke for every share of its puff gone)
    const gone = had - packLeft(foe!);
    push(enc, `${me.name}'S ${s.name}: ${them} -${m.loss} PUFF${w > 1 ? ', A STRONG ONE!' : gone && foe!.puff > 0 ? `. ${gone > 1 ? `${gone} GO` : 'ONE GOES'} UP IN ${gone > 1 ? 'PUFFS' : 'A PUFF'} OF SMOKE` : ''}`);
    if (foe!.puff <= 0) enc.moves.splice(m.n + 1);
    return;
  }
  // (a try at the check: the die, the bonus, the score against the mark)
  const bonus = o?.bonus ?? bonusOf(s.power, me.stats.power * stageMult(enc.power[i]), w);
  m.roll = rollOf(hitRoll); m.score = m.roll + bonus; m.hit = passes(m.roll, bonus, enc.mark);
  const c = CHALLENGES[stop.challenge!], sum = `${m.roll} + ${bonus} = ${m.score}`;
  if (m.hit) {
    push(enc, m.roll >= SIDES ? `A TWENTY! ${me.name}'S ${s.name} CLEARS IT: ${sum}` : `${me.name}'S ${s.name}: ${sum} BEATS ${enc.mark}!${s.type === 'plain' && charmStop(stop) ? ` ${c.charmed}` : ''}`);
    enc.mark = 0;
    enc.moves.splice(m.n + 1);
  } else push(enc, m.roll <= 1 ? `A ONE... ${me.name}'S ${s.name} FALLS SHORT: ${sum}` : `${me.name}'S ${s.name}: ${sum} FALLS SHORT OF ${enc.mark}`);
}
/**
 * How many of a pack are still standing: one for every share of its whole puff it has left, any part of one a whole one
 * (a boss: 1 while it has puff). The view poofs the rest (missionview.ts).
 */
export function packLeft(foe: Foe): number {
  if (foe.puff <= 0) return 0;
  return Math.min(foe.pack, Math.ceil((foe.puff * foe.pack) / Math.max(1, foe.stats.puff) - 1e-9));
}

/** A rider's special in a fight, in words: CHARM charms, MEDIC soothes, NAVIGATOR outwits, NIMBLE dodges round. */
function riderVerb(look: KeeperId): string {
  switch (KEEPER_SKILL[look]) {
    case 'charm': return 'CHARMS';
    case 'medic': return 'SOOTHES';
    case 'navigator': return 'OUTWITS';
    case 'nimble': return 'DODGES ROUND';
  }
}

/**
 * The turn ends: an obstacle still standing bites (BITE puff off every dragon with puff left) and, with another try to
 * come, its mark eases by MARK_EASE; then the outcome, if any -- cleared (the check passed, the baddie out of puff), or
 * waited out (every dragon out of puff, or the last turn) -- else null: another turn.
 */
export function endTurn(enc: Encounter, party: Party, stop: Stop): 'cleared' | 'waited' | null {
  if (enc.kind === 'obstacle') {
    if (enc.mark <= 0) return 'cleared';
    let bit = 0;
    party.puff.forEach((p, i) => { if (p > 0) { const b = Math.min(p, BITE); party.puff[i] -= b; bit++; } });
    const last = party.puff.every((p) => p <= 0) || enc.turn >= MAX_OBSTACLE_TURNS;
    if (!last) enc.mark = Math.max(1, enc.mark - MARK_EASE);
    if (bit) push(enc, `${CHALLENGES[stop.challenge!].bite}: -${BITE} PUFF EACH${last ? '' : `. THE MARK EASES TO ${enc.mark}`}`);
    if (last) return 'waited';
    return null;
  }
  if (enc.foe!.puff <= 0) return 'cleared';
  if (party.puff.every((p) => p <= 0) || enc.turn >= MAX_FIGHT_TURNS) return 'waited';
  return null;
}

/** How a fight's stop ends, in words (stopLine; missions.ts's upgrade writes a resolved stop's line with it too): a boss worn out or not, a pack. */
export function fightLine(name: string, pack: boolean, cleared: boolean): string {
  if (pack) return cleared ? `${name} - FOUGHT OFF: THE LAST ONE GOES UP IN A PUFF OF SMOKE` : `${name} - THE TEAM SITS DOWN FOR A BREATHER, AND THEY SCAMPER OFF`;
  return cleared ? `${name} - WORN OUT: IT SEES STARS AND RUNS OFF` : `${name} - THE TEAM SITS DOWN FOR A BREATHER, AND IT STOMPS OFF UNBEATEN`;
}

/**
 * The stop's log line once it is resolved, always `NAME - HOW`: cleared by its counter's move or the rider's special
 * (`SPRING FLOOD - RIPPLE SWIMS THEM ACROSS`), cleared by work (`SPRING FLOOD - THE WATER GOES DOWN`), waited out
 * (`SPRING FLOOD - THE TEAM WAITS IT OUT`); a boss worn out (`THE MOLE KING - WORN OUT: IT SEES STARS AND RUNS OFF`) or
 * not (`THE MOLE KING - THE TEAM SITS DOWN FOR A BREATHER, AND IT STOMPS OFF UNBEATEN`); a pack fought off
 * (`MUD GOBLINS - FOUGHT OFF: THE LAST ONE GOES UP IN A PUFF OF SMOKE`) or not (`... AND THEY SCAMPER OFF`). Never the
 * trip's outcome.
 */
export function stopLine(enc: Encounter, party: Party, stop: Stop, outcome: 'cleared' | 'waited'): string {
  const name = stopName(stop);
  if (enc.kind === 'fight') return fightLine(name, stop.kind === 'foes', outcome === 'cleared');
  const c = CHALLENGES[stop.challenge!];
  if (outcome === 'waited') return `${name} - THE TEAM WAITS IT OUT`;
  // (the move that finished it: its counter's, the rider's special, or another's try)
  const last = enc.moves.slice().reverse().find((m) => m.landed && m.hit && m.ability !== 'rest');
  if (last && last.by !== FOE) {
    const me = party.members[last.by];
    if (last.ability === 'rider') return `${name} - ${me.riderName} ${c.met}`;
    if (last.ability !== 'rest' && last.ability !== 'sit' && skillOf(me.el, last.ability as SkillKind).type === 'element' && me.el === stopElement(stop)) return `${name} - ${me.name} ${c.met}`;
  }
  return `${name} - ${c.done}`;
}

// ---------- the encounter in the world ----------

/** The step a stop is reached at, in the trip's walk (its `at` of the travel). */
export function stopStart(trip: Trip, j: number): number { return Math.round(trip.stops[j].at * trip.travel); }

/**
 * The team reaches stop j (missions.ts stepAway): the walk's rest, the encounter begun (an obstacle's meet, an enemy's
 * walk-in), its opening line, and a `meet` event for the view's toast.
 */
export function beginEncounter(sim: CareSim, trip: Trip, j: number): Encounter {
  const enc = newEncounter(trip, j), party = partyOf(sim, trip), stop = trip.stops[j];
  walkRest(party);
  push(enc, meetLine(enc, stop));
  trip.encounter = enc;
  sim.events.push({ kind: 'meet', stop: j, name: stopName(stop), fight: enc.kind === 'fight' });
  return enc;
}

/** The player's pick for pair i (an `ability` command): only while the picks wait, for a pair still to pick, and an ability it has here. */
export function pickAbility(sim: CareSim, trip: Trip, i: number, ability: Ability): void {
  const enc = trip.encounter;
  if (!enc || enc.state !== 'pick' || i < 0 || i >= enc.picks.length || enc.picks[i] != null) return;
  const party = partyOf(sim, trip);
  if (!canAct(party, i) || !offerOf(enc, party, trip.stops[enc.stop], i, ability)) return;
  enc.picks[i] = ability;
  enc.t = 0;
}

/** The pair whose pick the menu waits for (the first still to pick with puff left), or -1. */
export function pendingPair(trip: Trip): number {
  const enc = trip.encounter;
  if (!enc || enc.state !== 'pick') return -1;
  return enc.picks.findIndex((p, i) => p == null && trip.puff[i] > 0);
}

/** What a stop brings each pair's dragon (XP_ROAD): an obstacle's, a pack's, a boss's; cleared or not. */
export function xpOf(kind: Stop['kind'], cleared: boolean): number {
  if (kind === 'baddie') return cleared ? XP_ROAD.won : XP_ROAD.lost;
  if (kind === 'foes') return cleared ? XP_ROAD.pack : XP_ROAD.packLost;
  return cleared ? XP_ROAD.cleared : XP_ROAD.waited;
}

/** A stop's resolution beat: an obstacle's, a pack's (its last puff of smoke, or its scamper), a boss's exit (down seeing stars and off, or its stomp). */
export function beatOf(kind: Stop['kind']): number { return kind === 'baddie' ? EXIT_STEPS : kind === 'foes' ? PACK_EXIT : DONE_STEPS; }

/** Resolve the stop: its record, its line, the XP (training.ts levels and skills: `level` and `learn` events) and a `stopEnd` event. */
function resolve(sim: CareSim, trip: Trip, enc: Encounter, party: Party, outcome: 'cleared' | 'waited'): void {
  const stop = trip.stops[enc.stop], fight = enc.kind === 'fight';
  enc.outcome = outcome; enc.state = 'done'; enc.t = 0;
  stop.result = outcome === 'cleared' ? 'met' : 'unmet';
  stop.turns = enc.turn; stop.resolvedAt = sim.clock;
  stop.log = stopLine(enc, party, stop, outcome);
  push(enc, stop.log);
  const xp = xpOf(stop.kind, outcome === 'cleared');
  trip.pairs.forEach((p, i) => {
    const d = sim.dragons.find((q) => q.id === p.dragon);
    if (!d) return;
    const was = levelOf(d.xp);
    d.xp += xp; trip.xp[i] += xp;
    const now = levelOf(d.xp);
    if (now > was) {
      sim.events.push({ kind: 'level', dragon: d.id, level: now });
      for (const s of learnedBetween(d.element, was, now)) sim.events.push({ kind: 'learn', dragon: d.id, skill: s.kind });
    }
  });
  sim.events.push({ kind: 'stopEnd', stop: enc.stop, name: stopName(stop), cleared: outcome === 'cleared', fight, xp });
}

/**
 * A step of the encounter on (missions.ts stepAway): the meet's beat; the picks -- given, or the trail coach's (AUTO, or
 * once the pick has waited PICK_WAIT_TRAIL: then every pick still missing is the coach's at once) -- then the turn; the
 * moves, one after another, each landing at its impact (a mover out of puff by then sits it out); the turn's end; and
 * the resolution's beat (beatOf: an obstacle's DONE_STEPS, a pack's PACK_EXIT, a boss's EXIT_STEPS), after which the
 * trip walks on (encounter null). Every roll is the stop's own: liveRoll.
 */
export function stepEncounter(sim: CareSim, trip: Trip): void {
  const enc = trip.encounter;
  if (!enc) return;
  const stop = trip.stops[enc.stop], party = partyOf(sim, trip), roll = liveRoll(sim.seed, trip.mission.id, enc.stop, enc.turn + (enc.state === 'play' ? 0 : 1));
  enc.t++;
  switch (enc.state) {
    case 'meet':
      if (enc.t >= (enc.kind === 'fight' ? FOE_ENTER : MEET_STEPS)) { enc.state = 'pick'; enc.t = 0; }
      break;
    case 'pick': {
      const pending = enc.picks.some((p, i) => p == null && canAct(party, i));
      if (pending && (trip.auto || enc.t >= PICK_WAIT_TRAIL)) {
        enc.picks.forEach((p, i) => { if (p == null) enc.picks[i] = coachPick(enc, party, stop, i, roll(30 + i)); });
      } else if (pending) break;
      beginTurn(enc, party, roll);
      break;
    }
    case 'play': {
      const m = enc.moves[enc.cur];
      if (!m) { enc.state = 'pick'; enc.t = 0; break; }
      // (a mover out of puff by its turn sits it out: the move is dropped)
      if (m.t === 0 && m.by !== FOE && !canAct(party, m.by) && m.ability !== 'sit') { m.ability = 'sit'; }
      m.t++;
      if (m.t === m.at && !m.landed) landMove(enc, party, stop, m, roll);
      if (m.t < m.len + MOVE_GAP) break;
      if (++enc.cur < enc.moves.length) break;
      const out = endTurn(enc, party, stop);
      if (out) resolve(sim, trip, enc, party, out);
      else { enc.state = 'pick'; enc.t = 0; }
      break;
    }
    case 'done':
      if (enc.t >= beatOf(stop.kind)) trip.encounter = null;
      break;
  }
}

// ---------- the forecast (the chooser's, and BEST TEAM's) ----------

/** What the trail coach's dry run of a road says: the stops it clears, the stops, the turns the road takes it in all, and the share of its puff the team has left. */
export interface Forecast { cleared: number; stops: number; turns: number; puff: number }

/**
 * The trail coach's dry run of mission m's road with this team (BASE_DESIGN 11): every stop played by the rules with
 * the rolls fixed (evenRoll: every move lands with its middling spread, the enemy attacks the dragon with the most
 * puff, nobody gambles on a rest, yawn or preen), the walk's rest between stops. A pure function of the world's dragons
 * and keepers: the chooser's FORECAST, and BEST TEAM ranks teams by it.
 */
export function forecastRoad(sim: CareSim, m: Mission, pairs: readonly Pair[], stops: readonly Stop[]): Forecast {
  if (!pairs.length) return { cleared: 0, stops: stops.length, turns: 0, puff: 0 };
  const members = pairs.map((p): Member => {
    const d = sim.dragons.find((q) => q.id === p.dragon)!, k = sim.keepers.find((q) => q.id === p.keeper)!;
    return { name: d.name, el: d.element, stage: d.stage, level: levelOf(d.xp), stats: tripStats(d.element, d.stage, d.xp, d.mood, partnerPair(d, k)), rider: k.look, riderName: k.name };
  });
  const party: Party = { members, puff: members.map((q) => q.stats.puff) };
  const trip = { mission: m, pairs, stops: stops.map((s) => ({ ...s })), travel: 1 } as unknown as Trip;
  let cleared = 0, turns = 0;
  for (let j = 0; j < stops.length; j++) {
    const enc = newEncounter(trip, j), stop = trip.stops[j];
    walkRest(party);
    let out: 'cleared' | 'waited' | null = null;
    while (!out) {
      enc.picks = members.map((_, i) => coachPick(enc, party, stop, i, 0.5));
      beginTurn(enc, party, evenRoll, true);
      for (const mv of enc.moves) {
        if (mv.by !== FOE && !canAct(party, mv.by)) continue;
        landMove(enc, party, stop, mv, evenRoll);
      }
      out = endTurn(enc, party, stop);
    }
    if (out === 'cleared') cleared++;
    turns += enc.turn;
  }
  const whole = members.reduce((n, q) => n + q.stats.puff, 0);
  return { cleared, stops: stops.length, turns, puff: whole ? party.puff.reduce((n, p) => n + p, 0) / whole : 0 };
}

// ---------- for the view ----------

/** What a pair's dragon (or its rider) shows during its move: the anim to play from the move's first step (`key`: new each move), or a face once a move has landed on it. */
export interface Look { anim: string | null; rider: boolean; key: number; face: DFaceName | null }
/** A look's key: new for every move of every stop. */
const lookKey = (enc: Encounter, n: number) => enc.stop * 10000 + enc.turn * 10 + n;

/**
 * What pair i's dragon shows now (missionview.ts plays it), or null for the scene's own choice (standing at the stop):
 * during its own move, its skill's anim (a REST the sit) from the move's first step to its last -- or, for the rider's
 * special, `rider` true (the rider's moment plays, the dragon stands) -- and, a move landed on it (the enemy's), its
 * face for FACE_FRAMES: surprised at a cost, a grin at a dodge.
 */
export function pairLook(enc: Encounter, i: number): Look | null {
  if (enc.state !== 'play') return null;
  const m = enc.moves[enc.cur];
  if (!m) return null;
  if (m.by === i) {
    if (m.ability === 'sit' || m.t >= m.len) return null;
    if (m.ability === 'rider') return { anim: null, rider: true, key: lookKey(enc, m.n), face: null };
    const anim = m.ability === 'rest' ? REST_ANIM : null;
    return { anim, rider: false, key: lookKey(enc, m.n), face: null };
  }
  if (m.by === FOE && m.target === i && m.landed && m.t - m.at < FACE_FRAMES && m.foeMove !== 'rest') return { anim: null, rider: false, key: -1, face: m.hit ? 'surprised' : 'happy' };
  return null;
}
/** The skill anim a pair's dragon plays for a pick (a skill's own anim; a REST the sit), or null. */
export function pickAnim(el: DragonElement, pick: Pick | null): string | null {
  if (pick == null || pick === 'sit' || pick === 'rider') return null;
  if (pick === 'rest') return REST_ANIM;
  return skillOf(el, pick).anim;
}

/** A hit on the enemy rocks it back this many steps, and flashes it pale (cel.ts HIT_FLASH) this many. */
export const HIT_FRAMES = 14, FLASH_FRAMES = 6;
/** The enemy as it shows now: its face, its pose and whether a hit is flashing on it (a boss's and each of a pack's alike). */
export interface FoeShow { face: BaddieFace; pose: 'stand' | 'walk' | 'attack' | 'hit'; flash: boolean }
/**
 * The enemy's face and pose now (missionview.ts draws a boss and each of a pack by it): through its own move, an
 * attack's lunge until its missile has left its hand (FOE_THROW), a grumble's stomp (a walk in place), a boss's rest
 * stood still; a move of the team's landed on it -- a cost: rocked back HIT_FRAMES and flashing FLASH_FRAMES, wincing
 * for FACE_FRAMES; a yawn caught: dazed for FACE_FRAMES; else fierce, standing.
 */
export function foeShow(enc: Encounter): FoeShow {
  const stand: FoeShow = { face: 'fierce', pose: 'stand', flash: false };
  if (enc.state !== 'play') return stand;
  const m = enc.moves[enc.cur];
  if (!m) return stand;
  if (m.by === FOE) {
    if (m.t >= m.len) return stand;
    if (m.foeMove === 'attack') return { face: 'fierce', pose: m.t >= 4 && m.t < FOE_THROW + 8 ? 'attack' : 'stand', flash: false };
    return m.foeMove === 'grumble' ? { face: 'fierce', pose: 'walk', flash: false } : stand;
  }
  const since = m.t - m.at;
  if (m.landed && since >= 0 && since < FACE_FRAMES) {
    if (m.loss > 0) return { face: 'hurt', pose: since < HIT_FRAMES ? 'hit' : 'stand', flash: since < FLASH_FRAMES };
    if (m.moved?.who === FOE) return { face: 'dazed', pose: 'stand', flash: false };
  }
  return stand;
}

/** A landed move's popup: over whom (a pair's index, FOE, or `work` for the obstacle), its words and the note under them. */
export function popupOf(enc: Encounter, m: EMove): { on: number | 'work'; words: string; sub: string | null } | null {
  if (!m.landed) return null;
  if (m.by === FOE) {
    if (m.foeMove === 'rest') return { on: FOE, words: `+${m.gain}`, sub: null };
    if (m.foeMove === 'grumble') return { on: m.target, words: m.moved ? 'POWER DOWN' : 'NO LOWER', sub: null };
    return { on: m.target, words: m.hit ? `-${m.loss}` : 'DODGED!', sub: null };
  }
  if (m.ability === 'sit') return null;
  if (m.ability === 'rest') return { on: m.by, words: `+${m.gain}`, sub: null };
  if (m.ability === 'preen') return { on: m.by, words: m.moved ? 'GUARD UP' : 'NO HIGHER', sub: null };
  if (m.ability === 'yawn') return { on: FOE, words: m.moved ? 'POWER DOWN' : 'NO LOWER', sub: null };
  if (enc.kind === 'fight') return { on: FOE, words: m.hit ? `-${m.loss}` : 'DODGED!', sub: m.hit && m.ability !== 'rider' && m.loss > 0 && (m.ability === 'breath' || m.ability === 'big') && enc.foe && strongOnFoe(enc) ? 'STRONG!' : m.ability === 'rider' && m.moved ? 'POWER DOWN' : null };
  return { on: 'work', words: m.hit ? 'PASSED!' : 'NOT QUITE', sub: m.roll >= SIDES ? 'A TWENTY!' : m.roll <= 1 ? 'A ONE...' : `${m.score} VS ${markOfTurn(enc)}` };
}
/** The mark this turn's tries are checked against (the stop's, eased by the turns before it): what a passed try beat, once the mark is down. */
export function markOfTurn(enc: Encounter): number { return Math.max(1, enc.mark0 - Math.max(0, enc.turn - 1) * MARK_EASE); }
/** Whether the move playing now is a breath strong on the boss (its counter element): the popup's STRONG!. */
function strongOnFoe(enc: Encounter): boolean { return enc.moves[enc.cur]?.loss > 0 && enc.log[enc.log.length - 1]?.endsWith('A STRONG ONE!') === true; }

// ---------- saves ----------

/**
 * A save's encounter from before the obstacles were checks (save version 11: save.ts migrateSave), brought up to this
 * build: an obstacle's toughness and work become its mark (the road's difficulty's, as the stop began, and eased by the
 * turns played so far -- the work done is let go: the check is rolled afresh from here), a fight's stay 0, and every
 * move's work becomes no roll (a landed one keeps whether it hit). Anything else is returned as it is.
 */
export function upgradeEncounterV11(raw: unknown, difficulty: Difficulty): unknown {
  if (!raw || typeof raw !== 'object' || !('toughness' in raw)) return raw;
  const { toughness: _t, work: _w, ...rest } = raw as Encounter & { toughness: unknown; work: unknown };
  const fight = rest.kind === 'fight', mark0 = fight ? 0 : MARK[difficulty] ?? MARK.normal, turn = typeof rest.turn === 'number' ? rest.turn : 0;
  const played = rest.state === 'play' || rest.state === 'done' ? Math.max(0, turn - 1) : turn;
  const mark = fight ? 0 : rest.state === 'done' && rest.outcome === 'cleared' ? 0 : Math.max(1, mark0 - played * MARK_EASE);
  const moves = Array.isArray(rest.moves) ? rest.moves.map((m) => { const { work: _mw, ...mm } = m as EMove & { work?: unknown }; return { ...mm, roll: 0, score: 0 }; }) : rest.moves;
  return { ...rest, mark0, mark, moves };
}

/**
 * A save's encounter, checked (missions.ts checkMissions): at a stop of the road, in a state it knows, with whole
 * numbers where it counts (the mark within its start, a baddie's puff within its whole, stages -2..2, one pick a
 * pair, moves it can play) -- else it throws.
 */
export function checkEncounter(raw: unknown, pairs: number, stops: readonly Stop[]): void {
  const bad = (why: string): never => { throw new Error(`save: the encounter ${why}`); };
  if (!raw || typeof raw !== 'object') bad('is not one');
  const e = raw as Encounter, whole = (v: unknown, min = 0) => Number.isInteger(v) && (v as number) >= min, stage = (v: unknown) => Number.isInteger(v) && (v as number) >= STAGE_MIN && (v as number) <= STAGE_MAX;
  const pick = (p: unknown) => p === null || p === 'sit' || (ABILITIES as readonly string[]).includes(p as string);
  const stop = stops[e.stop];
  if (!whole(e.stop) || !stop || !ENCOUNTER_STATES.includes(e.state) || !whole(e.t) || !whole(e.turn) || (e.kind !== 'obstacle' && e.kind !== 'fight') || (e.kind === 'fight') !== (stop.kind !== 'challenge')) bad(`(${JSON.stringify({ stop: e.stop, kind: e.kind, state: e.state })}) is not at a stop of this road`);
  // (the stop is still ahead until the encounter is resolved; resolved, the stop says how it went while the beat plays out)
  if (stop.result !== (e.state === 'done' ? (e.outcome === 'cleared' ? 'met' : 'unmet') : 'ahead')) bad(`at ${e.state} has its stop ${stop.result}`);
  if (!Array.isArray(e.picks) || e.picks.length !== pairs || !e.picks.every(pick) || !Array.isArray(e.power) || !Array.isArray(e.guard) || !Array.isArray(e.special) || e.power.length !== pairs || e.guard.length !== pairs || e.special.length !== pairs
    || !e.power.every(stage) || !e.guard.every(stage) || !e.special.every((s) => typeof s === 'boolean')) bad('has picks or stages that are not the team\'s');
  if (!whole(e.mark0) || !whole(e.mark) || e.mark > e.mark0) bad(`has a mark of ${e.mark} from ${e.mark0}`);
  if (e.kind === 'fight') {
    const f = e.foe;
    const stats = (q: Stats) => !!q && typeof q === 'object' && whole(q.puff, 1) && whole(q.power, 1) && whole(q.guard, 1) && whole(q.speed);
    if (!f || f.id !== stopFoe(stop) || !stats(f.stats) || !whole(f.puff) || f.puff > f.stats.puff || !stage(f.power) || !stage(f.guard) || !whole(f.pack, 1) || (stop.kind === 'baddie' && f.pack !== 1)) bad(`has an enemy this build can't run: ${JSON.stringify(f)}`);
  } else if (e.foe !== null) bad('has an enemy at an obstacle');
  const move = (m: EMove) => m && typeof m === 'object' && Number.isInteger(m.by) && m.by >= FOE && m.by < pairs && whole(m.n) && whole(m.t) && whole(m.len, 1) && whole(m.at, 1)
    && (m.by === FOE ? m.ability === null && FOE_MOVE_KINDS.includes(m.foeMove!) : pick(m.ability) && m.ability !== null && m.foeMove === null)
    && typeof m.landed === 'boolean' && typeof m.hit === 'boolean' && whole(m.loss) && whole(m.roll) && m.roll <= SIDES && whole(m.score) && whole(m.gain);
  if (!Array.isArray(e.moves) || e.moves.length > pairs + 1 || !e.moves.every(move) || !whole(e.cur) || (e.state === 'play' && e.cur >= e.moves.length)) bad('has moves this build can\'t play');
  if (!(e.outcome === null || e.outcome === 'cleared' || e.outcome === 'waited') || (e.state === 'done') !== (e.outcome !== null) || !Array.isArray(e.log) || !e.log.every((l) => typeof l === 'string')) bad('has an outcome this build doesn\'t know');
}
