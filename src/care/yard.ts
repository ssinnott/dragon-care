// The yard (docs/KEEPERS.md 7): the keepers at work in a living scene. Six dragons whose needs rise over time and
// show -- a hungry dragon begs (its beg loop), a lonely one's mood sinks (and a slinkwing calls), a sleepy one yawns --
// and four keepers, each with a job and a station to go back to. Every tick a DIRECTOR sends each free keeper to the
// neediest dragon its job covers, and the care act (acts.ts) plays out:
//   Bea, the cook          feeds a hungry dragon (she brings the bowl from her kitchen);
//   Tomas, the groomer     grooms a lonely young or grown dragon;
//   Pip, the apprentice    pets a lonely baby, and cheers from his bench when a dragon is fed or groomed;
//   Iris, the night keeper tucks in a sleepy dragon; it sleeps until rested, then wakes.
// A fed dragon, which trotted off from its bowl, walks home; the keeper takes the bowl back and every keeper walks back
// to its station. Everything is stepped at 60 Hz from seeded state, so a frozen `t` is always the same frame.
import { clamp } from '../lib/engine/math.ts';
import { ELEMENTS } from '../art/dragon/elements/index.ts';
import { VARIANT_NAMES } from '../art/dragon/anims.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import { KEEPERS } from '../art/keeper/cast.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import { TOOL_BRUSH } from '../art/keeper/parts.ts';
import type { DragonAgent } from './dragon.ts';
import { makeDragon, playDragon, stepDragonAgent, turnDragon } from './dragon.ts';
import type { KeeperAgent } from './keeper.ts';
import { makeKeeper, stepKeeperAgent } from './keeper.ts';
import type { ActKind, CareAct } from './acts.ts';
import { beginFeed, beginPet, beginTuck, stepAct, walkAlong } from './acts.ts';
import type { Walk } from './acts.ts';

export type NeedName = 'hunger' | 'lonely' | 'sleepy';
export type Needs = Record<NeedName, number>;

/** A need shows at this level (a hungry dragon begs, a sleepy one yawns) and a keeper is sent. */
export const NEED_SHOW = 0.7;

/**
 * Seconds for a need to rise from 0 to 1, by stage: a baby is hungry, lonely and sleepy soonest, an elder hungry
 * latest; each dragon's own rates are these give or take 15 % (seeded).
 */
const FILL_S: Readonly<Record<Stage, Needs>> = {
  baby: { hunger: 42, lonely: 36, sleepy: 60 },
  young: { hunger: 52, lonely: 46, sleepy: 74 },
  adult: { hunger: 62, lonely: 54, sleepy: 88 },
  elder: { hunger: 72, lonely: 48, sleepy: 70 },
};
/** Seconds a tucked-in dragon sleeps before it wakes (its sleepiness runs down over them). */
const SLEEP_S = 24;

/** What each keeper does: the need it answers, the act, and which dragons are its to care for. */
interface Job { need: NeedName; act: ActKind; fits: (st: Stage) => boolean }
const JOBS: Readonly<Record<KeeperId, Job>> = {
  bea: { need: 'hunger', act: 'feed', fits: () => true },
  iris: { need: 'sleepy', act: 'tuck', fits: () => true },
  tomas: { need: 'lonely', act: 'pet', fits: (st) => st !== 'baby' },
  pip: { need: 'lonely', act: 'pet', fits: (st) => st === 'baby' },
};
/** The order the director asks the keepers in: a dragon hungry and sleepy both is fed first, then tucked in. */
const ASK: readonly KeeperId[] = ['bea', 'iris', 'tomas', 'pip'];

/** What a dragon is doing, as far as the yard is concerned. */
type DragonState = 'free' | 'care' | 'home' | 'asleep' | 'waking';

export interface YardDragon {
  d: DragonAgent;
  name: string;
  needs: Needs;
  /** Per-tick rises of each need. */
  rate: Needs;
  /** Where it lives in the yard: the spot it goes back to, and the way it faces there. */
  home: { x: number; facing: number };
  state: DragonState;
  /** The keeper caring for it, while it is in an act. */
  by: YardKeeper | null;
  /** A need already shown (its yawn, its call): shown once until it is met. */
  shown: Partial<Record<NeedName, boolean>>;
  /** Its happy has been cheered (by the apprentice, from the bench). */
  cheered: boolean;
}

export interface YardKeeper {
  k: KeeperAgent;
  job: Job;
  /** Its station: where it waits between jobs, and the way it faces there. */
  station: { x: number; y: number; facing: number };
  act: CareAct | null;
  /** The dragon of its act. */
  with: YardDragon | null;
  /** Its walk back to its station, when it is not in an act. */
  walk: Walk | null;
}

/** One dragon of the yard's cast: its look, its home spot and facing, and the needs it starts with. */
interface CastRow { el: DragonElement; stage: Stage; x: number; y: number; facing: number; needs: Needs }

/**
 * The yard's six dragons, in two rows with room round each one: in front for a bowl and a keeper setting it down (a
 * feed is front on), behind for a keeper at its shoulder (a pet, a groom, a tuck-in is from the side, acts.ts). They
 * start with their needs staggered, so the keepers are soon at work, one after another: the fire baby is already
 * hungry, the spike adult nearly lonely, the dusk adult nearly sleepy.
 */
const CAST: readonly CastRow[] = [
  { el: 'spike', stage: 'adult', x: 150, y: 214, facing: 1, needs: { hunger: 0.3, lonely: 0.66, sleepy: 0.2 } },
  { el: 'dusk', stage: 'adult', x: 348, y: 206, facing: -1, needs: { hunger: 0.1, lonely: 0.2, sleepy: 0.68 } },
  { el: 'water', stage: 'young', x: 498, y: 220, facing: 1, needs: { hunger: 0.52, lonely: 0.1, sleepy: 0.3 } },
  { el: 'fire', stage: 'baby', x: 124, y: 310, facing: 1, needs: { hunger: 0.72, lonely: 0.3, sleepy: 0.1 } },
  { el: 'slinkwing', stage: 'baby', x: 318, y: 318, facing: -1, needs: { hunger: 0.2, lonely: 0.6, sleepy: 0.35 } },
  { el: 'rock', stage: 'elder', x: 492, y: 314, facing: 1, needs: { hunger: 0.4, lonely: 0.35, sleepy: 0.45 } },
];

/**
 * The keepers' stations along the back of the yard, in the band behind the dragons (a keeper behind a dragon is drawn
 * under it and covers nothing: path.ts): Bea's kitchen, Tomas's grooming shed, Iris's lamp and Pip's bench, each over
 * the dragons it mostly works with and facing into the yard.
 */
const STATIONS: Readonly<Record<KeeperId, { x: number; y: number; facing: number }>> = {
  bea: { x: 64, y: 150, facing: 1 },
  tomas: { x: 246, y: 146, facing: 1 },
  iris: { x: 432, y: 148, facing: -1 },
  pip: { x: 586, y: 152, facing: -1 },
};

/** The floor the keepers walk on: the whole yard but a margin at the sides and the bottom, and the sky over the stations. */
const FLOOR = { x0: 8, y0: 128, x1: 632, y1: 352 } as const;

/**
 * The anims a dragon may play before long, by what it is doing (DragonAgent.soon: a keeper's walk keeps off its eye
 * through all of them): at home idle, its variants, the beg and its needs' tells; being fed, the walk to its bowl, the
 * bites, the happy; petted, the pet loop and the happy; tucked in, the lie-down; asleep, the wake.
 */
function soonFor(y: YardDragon): readonly string[] {
  const act = y.by?.act?.kind, sleep = y.d.player.has('tuckin') ? 'tuckin' : 'sleep';
  switch (y.state) {
    case 'free': return FREE_SOON;
    case 'care': return act === 'feed' ? ['beg', 'walk', 'eat', 'happy', 'idle'] : act === 'pet' ? ['idle', 'pet', 'happy'] : ['idle', sleep];
    case 'home': return ['walk', 'idle'];
    case 'asleep': return [sleep, 'wake'];
    case 'waking': return ['wake', 'idle'];
  }
}
const FREE_SOON: readonly string[] = ['idle', 'beg', 'call', ...VARIANT_NAMES];

/** A small seeded generator (the yard's own: the same seed, the same yard). */
function rng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export class Yard {
  readonly dragons: YardDragon[];
  readonly keepers: YardKeeper[];
  tick = 0;
  /** Every dragon in the yard (what a keeper's walk goes round). */
  readonly world = (): readonly DragonAgent[] => this.dragons.map((y) => y.d);

  constructor(seed = 1) {
    const r = rng(seed * 7919 + 13);
    this.dragons = CAST.map((c, i) => {
      const d = makeDragon(c.el, c.stage, seed + i * 17, 'idle', c.x, c.y, { facing: c.facing });
      const jitter = () => 1 + (r() - 0.5) * 0.3, f = FILL_S[c.stage];
      const rate: Needs = { hunger: jitter() / (f.hunger * 60), lonely: jitter() / (f.lonely * 60), sleepy: jitter() / (f.sleepy * 60) };
      return { d, name: ELEMENTS[c.el].name, needs: { ...c.needs }, rate, home: { x: c.x, facing: c.facing }, state: 'free' as DragonState, by: null, shown: {}, cheered: false };
    });
    this.keepers = (Object.keys(STATIONS) as KeeperId[]).map((id, i) => {
      const s = STATIONS[id];
      return { k: makeKeeper(id, 'idle', s.x, s.y, { facing: s.facing, seed: seed + 101 + i }), job: JOBS[id], station: { ...s }, act: null, with: null, walk: null };
    });
  }

  /** One 60 Hz step: the needs, the director, the acts, and everyone not in one. */
  step(): void {
    this.tick++;
    // (a dragon being fed turns and trots off from its bowl, and one walking home turns round at the end: the keepers'
    // walks keep off both its facings, path.ts)
    for (const y of this.dragons) {
      y.d.restless = y.state === 'home' || (y.state === 'care' && y.by?.act?.kind === 'feed');
      y.d.soon = soonFor(y);
    }
    for (const y of this.dragons) this.stepNeeds(y);
    this.direct();
    for (const yk of this.keepers) this.stepKeeper(yk);
    for (const y of this.dragons) if (!(y.state === 'care' && y.by?.act?.ownsDragon)) this.stepDragon(y);
  }

  /** Needs rise (asleep, only hunger, slowly; the sleep runs down); a need that shows, shows. */
  private stepNeeds(y: YardDragon): void {
    const n = y.needs, r = y.rate;
    if (y.state === 'asleep') {
      n.hunger = Math.min(1, n.hunger + r.hunger * 0.25);
      n.sleepy = Math.max(0, n.sleepy - 1 / (SLEEP_S * 60));
      return;
    }
    n.hunger = Math.min(1, n.hunger + r.hunger);
    n.lonely = Math.min(1, n.lonely + r.lonely);
    n.sleepy = Math.min(1, n.sleepy + r.sleepy);
    // its resting mood: content, sinking as it gets lonely or hungry (the rig's mood cue and face show it)
    y.d.mood = clamp(0.3 - 0.8 * Math.max(0, n.lonely - 0.3) - 0.4 * Math.max(0, n.hunger - 0.5), -1, 1);
  }

  /** Every free keeper takes the neediest free dragon its job covers, if one needs it now. */
  private direct(): void {
    for (const id of ASK) {
      const yk = this.keepers.find((k) => k.k.id === id)!;
      // (busy, or mid-cheer: the apprentice finishes his cheer before he goes)
      if (yk.act || yk.k.player.name === 'cheer') continue;
      const j = yk.job;
      let best: YardDragon | null = null;
      for (const y of this.dragons) {
        if (y.state !== 'free' || !j.fits(y.d.stage) || y.needs[j.need] < NEED_SHOW) continue;
        if (!best || y.needs[j.need] > best.needs[j.need]) best = y;
      }
      if (!best) continue;
      const k = yk.k, d = best.d, s = yk.station, scene = { world: this.world, floor: FLOOR };
      yk.act = j.act === 'feed' ? beginFeed(k, d, s.x, s.y, scene) : j.act === 'pet' ? beginPet(k, d, s.x, s.y, scene) : beginTuck(k, d, s.x, s.y, scene);
      yk.with = best; best.state = 'care'; best.by = yk;
    }
  }

  /**
   * A keeper in an act plays it (the act walks it back to its station at the end); back there, it turns to face the
   * yard and waits (Bea puts the empty bowl away in her kitchen).
   */
  private stepKeeper(yk: YardKeeper): void {
    const a = yk.act, k = yk.k, s = yk.station;
    if (a) {
      const wasOwned = a.ownsDragon;
      stepAct(a);
      // the need is met as it is met (the last bite, the hand let go), so the dragon's mood lifts with its happy (a
      // tucked-in dragon's sleepiness is the sleep's to run down: 'asleep')
      if (a.met && yk.with && yk.job.need !== 'sleepy') yk.with.needs[yk.job.need] = 0;
      // the act lets the dragon go as the keeper walks off: it goes home (or sleeps)
      if (wasOwned && !a.ownsDragon && yk.with) this.release(yk.with, a);
      if (a.done) {
        yk.act = null; yk.with = null;
        k.facing = s.facing; k.rig.bowl = null; k.rig.weapon = k.rig.spec.tool === 'brush' ? TOOL_BRUSH : null;
        k.player.play('idle', { restart: true, blend: 10 });
      }
      return;
    }
    if (k.x !== s.x || k.y !== s.y) {
      const r = walkAlong(k, yk.walk, s.x, s.y, 'walk', this.world(), FLOOR);
      yk.walk = r.arrived ? null : r.walk;
      if (r.arrived) { k.facing = s.facing; k.player.play('idle', { restart: true, blend: 10 }); stepKeeperAgent(k); }
      return;
    }
    // the apprentice, waiting at the bench, cheers the others on: once for each happy that thanks a keeper
    if (k.id === 'pip') {
      for (const y of this.dragons) {
        const happy = y.state === 'care' && y.d.player.name === 'happy';
        if (happy && !y.cheered && k.player.name === 'idle') { y.cheered = true; k.player.play('cheer', { restart: true, blend: 6 }); }
        else if (!happy) y.cheered = false;
      }
      if (k.player.done && k.player.name === 'cheer') k.player.play('idle', { restart: true, blend: 10 });
    }
    stepKeeperAgent(k);
  }

  /** The act is over for the dragon (its need was met as the act met it): on with its day. */
  private release(y: YardDragon, a: CareAct): void {
    y.by = null; y.shown = {};
    y.state = a.kind === 'tuck' ? 'asleep' : 'home';
  }

  /** A dragon on its own: idle at home (showing its needs), walking home, asleep, or waking. */
  private stepDragon(y: YardDragon): void {
    const d = y.d, n = y.needs;
    let roam = false;
    switch (y.state) {
      case 'free': {
        // a hungry dragon begs; fed (or not yet hungry) it idles
        const begging = d.player.name === 'beg';
        if (n.hunger >= NEED_SHOW && !begging && !d.player.inVariant) playDragon(d, 'beg', { blend: 12 });
        else if (n.hunger < NEED_SHOW && begging) playDragon(d, 'idle', { blend: 12 });
        // a sleepy one yawns, once; a lonely slinkwing calls, once
        if (!begging && d.player.name === 'idle') {
          if (n.sleepy >= NEED_SHOW && !y.shown.sleepy && d.player.has('yawn')) { y.shown.sleepy = true; playDragon(d, 'yawn', { blend: 8 }); }
          else if (n.lonely >= NEED_SHOW && !y.shown.lonely && d.player.has('call')) { y.shown.lonely = true; playDragon(d, 'call', { blend: 8 }); }
        }
        break;
      }
      case 'home': {
        // back to its spot (a fed dragon trotted away from its bowl), then round to face the way it lives
        const dx = y.home.x - d.x;
        if (d.turning >= 0) break;
        if (Math.abs(dx) >= 1) {
          if (Math.sign(dx) !== d.facing) { turnDragon(d); break; }
          if (d.player.name !== 'walk') playDragon(d, 'walk', { blend: 8 });
          roam = Math.abs(d.player.move) * d.scale < Math.abs(dx);
          if (!roam) d.x = y.home.x;
          break;
        }
        d.x = y.home.x;
        if (d.facing !== y.home.facing) { turnDragon(d); break; }
        if (d.player.name === 'walk') playDragon(d, 'idle', { blend: 10 });
        y.state = 'free';
        break;
      }
      case 'asleep':
        if (n.sleepy <= 0) { playDragon(d, 'wake', { blend: 6 }); y.state = 'waking'; }
        break;
      case 'waking':
        if (d.player.name !== 'wake') y.state = 'free';
        break;
      case 'care':
        break;
    }
    stepDragonAgent(d, roam);
  }

  /** What each keeper is doing, for a caption: "BEA FEEDS EMBER", "IRIS AT HER LAMP". */
  captions(): string[] {
    return this.keepers.map((yk) => {
      const name = KEEPERS[yk.k.id].name.toUpperCase();
      if (yk.act && yk.with) {
        const verb = yk.act.kind === 'feed' ? 'FEEDS' : yk.act.kind === 'tuck' ? 'TUCKS IN' : yk.k.rig.spec.tool === 'brush' ? 'GROOMS' : 'PETS';
        return yk.act.ownsDragon ? `${name} ${verb} ${yk.with.name.toUpperCase()}` : `${name} HEADS BACK`;
      }
      if (yk.k.player.name === 'cheer') return `${name} CHEERS`;
      return yk.k.x === yk.station.x && yk.k.y === yk.station.y ? `${name} WAITS` : `${name} HEADS BACK`;
    });
  }
}
