// The base, live (docs/BASE_DESIGN.md 2, 4): the greybox barn and towers at 1x with the care simulation (sim.ts)
// running underneath -- its dragons on the real rig, its keepers on the engine's paper doll -- the need bubbles, the
// job strip, and two inputs: drag to look around, and tap a bubble, a job or a dragon to Rush it. A gallery scene
// (view=base in src/gallery.ts), so the frozen-time contract holds: t= steps the world t times and draws that frame.
// The world is built from a start (src/game/presets.ts: the new game, or a preset); its dragons are drawn by a cast
// keyed by dragon id, which follows the simulation as dragons come, go and grow. The simulation walks the dragons to
// their needs' rooms and rides them on the Dragon Lift (travel.ts); the view puts each pet where its dragon is, plays
// its walk from the start of every walk bout at speed 1 (the sim moved it by that walk's own root motion, so the paws
// stay planted), narrows it through a paper turn, and draws the lift's car where the car is.
// Time (7): the sky behind the building turns with the clock and the lights come on at dusk -- night is drawn there
// alone, never on a dragon, a floor or a wall (plan G8; layers=world draws the world without it) -- and the view runs
// 0, 1, 2, 4 or 8 whole world steps a frame (the speed, the view's own: a save has none). The constructor never touches
// storage: a live page that may save (opts.persist) loads the player's barn in attach() and saves it as it goes, every
// 600 frames and when the page is hidden or left (storage.ts); a frozen page never calls attach(), so t= is always the
// new game (or the preset) stepped t times at 1x.
// Growing up and eggs (7; plan S5): a dragon that grows up is rebuilt at its new stage, drawn flat in its glow's
// highlight inside its own ink for 12 steps (the grow-up's flash, ART_BIBLE 4.2: the one flash the base draws, never
// for the time of day) and plays `happy` once, with a toast;
// the Hatchery's eggs lie in their nests (eggs.ts: their cracks and wobble), and one that hatches throws its shell bits
// as the baby stands up; at 05:00 a tip says who grows up within two days. A tap on a dragon with nothing waiting opens
// its card (its stage and day of it, its needs: hud.ts); a tap on one with a job waiting still Rushes it.
import { drawDragon, rootToScreen } from '../art/dragon/rig.ts';
import { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { ELEMENT_ANIM_FALLBACK } from '../art/dragon/anims.ts';
import { drawText } from '../lib/engine/text.ts';
import { resetChain } from '../lib/art/secondary.ts';
import { makePet, petOpts, stepPet, stepWary, extentX, bowlFor, drawBowl } from './pet.ts';
import type { Pet } from './pet.ts';
import { CareSim } from './sim.ts';
import type { Dragon, Job } from './sim.ts';
import { startSpec, buildSim } from './presets.ts';
import { worldKey, barnKey, fnv1a, serialize } from './save.ts';
import type { SaveV } from './save.ts';
import { readClock, hourSteps, PHASE_HOURS, HATCH_DAYS } from './clock.ts';
import type { Speed, ClockRead } from './clock.ts';
import { drawSky } from './sky.ts';
import { drawTopBar, drawToast, drawHint, drawCard, buttonAt, BUTTONS, BAR_H, TOAST_FRAMES, CARD } from './hud.ts';
import type { ButtonName } from './hud.ts';
import { loadSave, writeSave, clearSave, backupSave } from './storage.ts';
import { freshSeed } from '../lib/engine/rng.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { WORLD_W, WORLD_H, feetY, nestX } from './layout.ts';
import { drawEgg, drawShellBits, BITS_FRAMES } from './eggs.ts';
import { stageDue } from './life.ts';
import { walking, feetOf } from './travel.ts';
import { gaitOf, wrapT } from './gait.ts';
import { NEEDS, SOON, tierOf, chargeOf, hasNeed } from './needs.ts';
import type { NeedKind } from './needs.ts';
import { drawBuilding, drawPlates, drawLiftCar, drawLights } from './building.ts';
import { makeKeeperAgent, stepKeeperVisual, drawKeeperVisual } from './people.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { drawBubble, drawChip, hit } from './icons.ts';
import type { Rect } from './icons.ts';

const INK = '#1a1018';
export const VIEW_W = 640, VIEW_H = 360;
/** Behind everything (the page's own colour: index.html). */
const CLEAR = '#16141c';
/**
 * Where the camera starts: the barn's three floors, the kitchen and the romp room (EMBER and ZAP), the Dragon Lift
 * (its car starts at the ground floor), the ladder bay, and the first slots of the bathhouse, the grooming parlour and
 * the lamp dorm (RIPPLE, BRAMBLE and WICK), framed on the start: the dragons walk off to their needs from there. The
 * new game's seven young adults start in their need rooms' slots and span world
 * x 188-1177 (measured over their idles), wider than one screen; the five in the west rooms and the first slots east
 * of the ladder bay span x 188-841, 14 px more than a screen, so the frame starts at 204: all five faces whole, EMBER's
 * and ZAP's tail tips (at most 16 px) cut at the left edge, and every plate in it whole (the kitchen's and the romp
 * room's sit 44 px in from the barn's west wall: layout.ts platesOf). A drag shows COBBLE and ECHO.
 */
const START_CAM = { x: 204, y: 376 };
/** Chips in the job strip (4.8). */
const STRIP = 5;
/** What a job has the dragon do (4.4, the rig's anims: ART_BIBLE 4.2); dusk's bedtime is its own tuck-in (3.8). */
const ACT_ANIM: Readonly<Record<NeedKind, string>> = { food: 'eat', love: 'pet', play: 'happy', bath: 'happy', sleep: 'sleep' };
/** A drag starts once the pointer has moved this far (canvas px); less is a tap. */
const DRAG_PX = 4;
/** A live page that may save saves every this many frames (10 s), and when it is hidden or left. */
const AUTOSAVE_FRAMES = 600;
/** NEW asks again: a second tap within this many frames (2 s) starts a new barn. */
const NEW_FRAMES = 120;
/** The speeds the keys 1-4 and the speed button pick (world steps a frame); pause is 0. */
const RATES = [1, 2, 4, 8] as const;
type Rate = typeof RATES[number];
const DIDNT_FIT = 'NEW BARN: THE OLD SAVE DIDN\'T FIT';
/** A dragon that has just grown up is drawn flat (its glow's highlight, inside its ink) this many world steps (ART_BIBLE 4.2: the new silhouette's 12 f flash). */
const GROW_FLASH = 12;
/** What a grow-up's toast calls the new stage: "EMBER IS AN ELDER NOW!". */
const STAGE_NOW: Readonly<Record<Stage, string>> = Object.freeze({ baby: 'A BABY', young: 'YOUNG', adult: 'AN ADULT', elder: 'AN ELDER' });
/** The dawn's tip looks this many game days ahead for stage-ups. */
const TIP_DAYS = 2;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * How a base view starts: the world's seed, where the camera starts (world px, clamped), a preset, whether it may save,
 * the hour of day 1 the world starts at, and which layers it draws.
 */
export interface BaseViewOpts {
  seed: number;
  cam?: { x: number; y: number } | null;
  /** A start from presets.ts by name (null, or a name no preset has: the new game). */
  preset?: string | null;
  /** A live page that loads and autosaves in attach() (the gallery sets it only without t=, save=0, preset= or hour=). */
  persist?: boolean;
  /** The hour of day 1 the world starts at, 0-23 (null: 07:00, the new game's). A loaded save keeps its own clock (the gallery never has a page given an hour load). */
  hour?: number | null;
  /** 'world': only the building, the lift's car, the cast, the bubbles and the plates -- no sky, lights, HUD or toasts (the no-tint check). */
  layers?: 'all' | 'world';
}

/**
 * One dragon on screen: its pet, playing its wake before it goes back to idle, its eat bowl (found once), the stage it
 * was built at, the walk bout its walk anim was started for (-1: none yet; travel.ts Dragon.walkSeq), and after a
 * grow-up the world steps of its flash left and whether its `happy` is still playing (cheering).
 */
export interface PetView {
  pet: Pet;
  waking: boolean;
  bowl: { x: number; h: number; w: number } | null;
  stage: Stage;
  walkSeq: number;
  flash: number;
  cheering: boolean;
}

export class BaseView {
  readonly w = VIEW_W;
  readonly h = VIEW_H;
  /** The world: built from the start in the constructor; a live page may swap in the player's saved barn (attach) or a new one (NEW). */
  sim!: CareSim;
  /** The dragons on screen, by dragon id, in id order (syncCast keeps it matched to the simulation). */
  readonly cast = new Map<number, PetView>();
  /** Whether this page may load and autosave (attach). */
  readonly persist: boolean;
  /** Which layers draw() draws. */
  readonly layers: 'all' | 'world';
  /** World steps a frame while playing (the keys 1-4, the speed button), and whether it is paused (p, the pause button). Never saved: 1x after a load. */
  private rate: Rate = 1;
  private paused = false;
  camX = START_CAM.x;
  camY = START_CAM.y;
  /** Where the camera is easing to after a job chip was tapped (null: it stays put). */
  private camTo: { x: number; y: number } | null = null;
  private keeperAgents!: KeeperAgent[];
  private building!: HTMLCanvasElement;
  private plates!: HTMLCanvasElement;
  private readonly top = new TopPass(160);
  private readonly budget = new AmbientBudget();
  /** World steps drawn (the ambient budget's clock), and frames shown (the UI's: toasts, NEW's second tap, the autosave). */
  private frame = 0;
  private uiFrame = 0;
  /** The toast showing and the frames it has left; NEW's frames left to be tapped again (0: not asked). */
  private toast: { text: string; left: number } | null = null;
  private newArmed = 0;
  /** Attached with saving on: the autosave runs. */
  private saving = false;
  /** Last frame's bubbles (world px) and chips (screen px), for tapping. */
  private bubbles: { job: Job; r: Rect }[] = [];
  private chips: { job: Job; r: Rect }[] = [];
  /** The dragon whose card is open (by id; null: none). */
  private card: number | null = null;
  /** Hatches whose shell bits are flying: the egg's element, its nest's spot (world px) and the world steps since. */
  private hatches: { el: Dragon['element']; x: number; y: number; age: number }[] = [];
  /** Last frame's heads of the dragons drawn (screen px, by dragon id), for the hook. */
  private heads = new Map<number, { x: number; y: number }>();
  private detachers: (() => void)[] = [];

  constructor(opts: BaseViewOpts) {
    this.persist = !!opts.persist;
    this.layers = opts.layers === 'world' ? 'world' : 'all';
    if (opts.cam) this.setCam(opts.cam.x, opts.cam.y);
    this.use(buildSim(startSpec(opts.preset), opts.seed, opts.hour));
  }

  /**
   * Put a world on screen: its cast, its keepers' characters, its building and its plates (the constructor, a load,
   * NEW). All of them are built before any is swapped in, so a world the view can't build leaves the one on screen whole.
   */
  private use(sim: CareSim): void {
    const cast = new Map<number, PetView>();
    this.syncCast(sim, cast);
    const agents = sim.keepers.map((k) => makeKeeperAgent(k.look));
    const building = drawBuilding(sim.rooms), plates = drawPlates(sim.rooms);
    this.sim = sim;
    this.cast.clear();
    for (const [id, v] of cast) this.cast.set(id, v);
    this.keeperAgents = agents; this.building = building; this.plates = plates;
    this.bubbles = []; this.chips = []; this.card = null; this.hatches = []; this.heads.clear();
  }

  /**
   * Swap in the player's saved barn, if it holds together: CareSim.fromSave takes it, and the view builds it, steps it
   * once and draws it (off screen) -- a trial on one copy, so the barn itself, a second copy, resumes where it was
   * saved. False if any of that throws (a save of this version whose insides this build can't read: an element, a
   * stage, a keeper or a need it doesn't know): the page keeps the world it had, so the next autosave writes that over
   * the broken save, and a broken save can never freeze the page or be written back.
   */
  private load(save: SaveV): boolean {
    const was = this.sim, frame = this.frame, toast = this.toast;
    try {
      this.use(CareSim.fromSave(save));
      this.worldStep();
      const trial = document.createElement('canvas');
      trial.width = VIEW_W; trial.height = VIEW_H;
      this.draw(trial.getContext('2d')!);
      this.use(CareSim.fromSave(save));
      return true;
    } catch {
      this.use(was);
      return false;
    } finally {
      // (and nothing of the trial is left over for the first real frame: the frame count, the top pass's queue, a toast
      // its step said)
      this.frame = frame; this.top.clear(); this.toast = toast;
    }
  }

  /** Every dragon's pet, in id order. */
  get pets(): Pet[] { return [...this.cast.values()].map((v) => v.pet); }

  /** World steps a frame: 0 paused, else 1, 2, 4 or 8. */
  get speed(): Speed { return this.paused ? 0 : this.rate; }

  /**
   * A dragon's feet: on the lift's car while it rides, else its floor's straw band, a px apart from its neighbours' so
   * the y-sort never ties -- and waiting in a landing's line deeper, a px more per place, so each one waiting is drawn
   * over the ones ahead of it and the dragons in the slots, whose eyes its place keeps clear (travel.ts feetOf).
   */
  private feet(d: Dragon): number { return feetOf(this.sim, d); }

  /**
   * Match a cast to a world's dragons (the view's own, by default): a pet for a dragon it hasn't seen, none for one
   * that's gone, and a new one for a dragon that has grown into another stage (a new rig: its stage's proportions and anims).
   */
  private syncCast(sim: CareSim = this.sim, cast: Map<number, PetView> = this.cast): void {
    const ids = new Set<number>();
    for (const d of sim.dragons) {
      ids.add(d.id);
      const v = cast.get(d.id);
      if (v && v.stage === d.stage) continue;
      const pet = makePet(d.element, d.stage, d.seed, 'idle', d.x, feetOf(sim, d), { facing: d.facing, mood: v ? v.pet.mood : d.mood });
      cast.set(d.id, { pet, waking: false, bowl: null, stage: d.stage, walkSeq: -1, flash: 0, cheering: false });
    }
    for (const id of cast.keys()) if (!ids.has(id)) cast.delete(id);
  }

  // ---------- a step ----------

  /**
   * A frame: `speed` whole world steps (each the simulation's step, then the cast, the pets and the keepers' characters
   * after it, exactly as at 1x: a faster speed is more of the same steps, never longer ones), then the camera eases and
   * the UI's timers run once. Paused, only the camera and the UI move. A frozen page's steps are always at 1x.
   */
  step(): void {
    for (let n = this.speed; n > 0; n--) this.worldStep();
    if (this.camTo) {
      this.setCam(this.camX + (this.camTo.x - this.camX) / 6, this.camY + (this.camTo.y - this.camY) / 6);
      if (Math.abs(this.camTo.x - this.camX) < 0.5 && Math.abs(this.camTo.y - this.camY) < 0.5) { this.setCam(this.camTo.x, this.camTo.y); this.camTo = null; }
    }
    this.uiFrame++;
    if (this.toast && --this.toast.left <= 0) this.toast = null;
    if (this.newArmed > 0) this.newArmed--;
    if (this.saving && this.uiFrame % AUTOSAVE_FRAMES === 0) this.save();
  }

  /** One world step, and the view kept in step with it (a grow-up's flash and cheer, a hatch's shell bits, the dawn's tip). */
  private worldStep(): void {
    for (const v of this.cast.values()) if (v.flash > 0) v.flash--;
    for (const h of this.hatches) h.age++;
    this.hatches = this.hatches.filter((h) => h.age < BITS_FRAMES);
    this.sim.step();
    this.syncCast();
    this.lifeEvents();
    for (const d of this.sim.dragons) this.sync(d, this.cast.get(d.id)!);
    const pets = this.pets;
    stepWary(pets);
    for (const p of pets) stepPet(p);
    this.sim.keepers.forEach((k, i) => stepKeeperVisual(this.keeperAgents[i], k, k.climbing ? k.y : k.y - 3));
    this.frame++;
  }

  /**
   * What the step's life events look like (plan S5): a dragon grown up -- already rebuilt at its new stage (syncCast) --
   * flashes flat for GROW_FLASH steps and plays `happy` once, and a toast says so; a hatch throws its egg's shell
   * bits from the nest the baby stands up in. And at 05:00 (the dawn), a tip: the dragons whose stage-up falls due
   * within TIP_DAYS days.
   */
  private lifeEvents(): void {
    const sim = this.sim;
    for (const e of sim.events) {
      const d = sim.dragons.find((q) => q.id === e.dragon), v = this.cast.get(e.dragon);
      if (!d || !v) continue;
      if (e.kind === 'grow') {
        v.flash = GROW_FLASH; v.cheering = true;
        v.pet.player.play('happy', { restart: true, blend: 4 }); v.pet.anim = 'happy'; v.waking = false;
        this.say(`${d.name} IS ${STAGE_NOW[e.stage]} NOW!`);
      } else {
        const room = sim.rooms.find((r) => r.kind === 'hatchery');
        if (room) this.hatches.push({ el: d.element, x: nestX(room, Math.max(0, Math.min(2, Math.round((d.x - nestX(room, 0)) / 50)))), y: feetY(room.floor) - 12, age: 0 });
      }
    }
    if (sim.clock % sim.dayLen === PHASE_HOURS.dawn * hourSteps(sim.dayLen)) {
      const soon = sim.dragons.filter((d) => d.stage !== 'elder' && stageDue(sim, d) - sim.clock <= TIP_DAYS * sim.dayLen);
      if (soon.length) this.say(soon.length === 1 ? `${soon[0].name} GROWS UP IN ${TIP_DAYS} DAYS` : `${soon.length} DRAGONS GROW UP IN ${TIP_DAYS} DAYS`);
    }
  }

  /**
   * What a dragon's anim should be when it isn't walking: its job's while a keeper is at work with it, its tell while
   * it waits (standing, at a landing, at the bay's edge or riding), else idle (a paper turn too: travel.ts).
   */
  private animFor(d: Dragon): string {
    if (d.act) return d.act.need === 'sleep' && d.element === 'dusk' ? 'tuckin' : ACT_ANIM[d.act.need];
    const j = this.waitingJob(d);
    // the hungry tell (4.2), and slinkwing's lonely call (3.7)
    if (j && j.need === 'food' && d.needs.food < SOON && d.move !== 'turn') return 'beg';
    if (j && j.need === 'love' && d.element === 'slinkwing' && d.needs.love < SOON && d.move !== 'turn') return 'call';
    return 'idle';
  }

  /**
   * Point a pet at its dragon (plan S3): where it stands (on the car while riding) and faces; a walk bout's walk,
   * restarted at speed 1 on the bout's first step (so the anim's root motion is the step's own: gait.ts); a paper
   * turn's narrowing; else its anim (a sleeper wakes before it idles), its bowl at a meal, its mood and charge.
   */
  private sync(d: Dragon, v: PetView): void {
    const p = v.pet;
    p.x = d.x; p.y = this.feet(d);
    // (the tail's chain starts again facing the other way, as the yard's turn does)
    if (p.facing !== d.facing) { p.facing = d.facing; resetChain(p.rig.tailChain); }
    p.turn = d.turn;
    if (walking(d) && d.gaitT > 0) {
      if (v.walkSeq !== d.walkSeq) {
        p.player.play('walk', { restart: true, speed: 1, blend: 8 });
        // (a view that meets a bout already under way -- a world loaded mid-walk -- catches the anim up to it: its
        // tick this step then lands on the bout's own frame, wrapped as the walk loops, back to its loop start: gait.ts moveAt)
        const n = wrapT(gaitOf(d.element, d.stage), d.gaitT - 1);
        for (let i = 0; i < n; i++) p.player.tick();
        p.anim = 'walk'; v.walkSeq = d.walkSeq; v.waking = false; p.hold = 0;
      }
    } else {
      // (a grow-up's happy plays through before anything else: the dragon is settled, so nothing else is asked of it yet)
      if (v.cheering && (p.player.done || p.player.name !== 'happy')) v.cheering = false;
      const want = v.cheering ? 'happy' : this.animFor(d);
      if (v.waking && p.player.done) { v.waking = false; p.player.play('idle', { blend: 8 }); p.anim = 'idle'; }
      if (want !== p.anim && !(v.waking && want === 'idle')) {
        if ((p.anim === 'sleep' || p.anim === 'tuckin') && want === 'idle') { p.player.play('wake', { blend: 8 }); p.anim = 'wake'; v.waking = true; }
        else { p.player.play(want, { blend: d.move === 'turn' ? 4 : 8, fallback: ELEMENT_ANIM_FALLBACK[want] }); p.anim = want; v.waking = false; }
        p.hold = 0;
      }
    }
    p.bowl = d.act && d.act.need === 'food' ? (v.bowl ??= bowlFor(p.rig, p.player.anims.eat ? p.player.anims.eat.frames : [])) : null;
    p.mood += (d.mood - p.mood) / 30;
    p.charge = chargeOf(d.element, d.needs);
  }

  /** A dragon's most pressing job that no keeper is already at work on: the one its bubble shows. */
  private waitingJob(d: Dragon): Job | null {
    let best: Job | null = null;
    for (const j of this.sim.jobs) {
      if (j.dragon !== d || (j.keeper && j.keeper.phase === 'work')) continue;
      if (!best || this.sim.compare(j, best) < 0) best = j;
    }
    return best;
  }

  // ---------- drawing ----------

  /**
   * The frame, back to front: the sky (screen space), the building, the lights, the plates, the lift's car, the cast,
   * the top pass, the bubbles, then the HUD and a toast. layers=world leaves out the sky, the lights, the HUD and the
   * toast: what is left is the same by day and by night (the no-tint check).
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const cx = Math.round(this.camX), cy = Math.round(this.camY), all = this.layers === 'all';
    const read = readClock(this.sim.clock, this.sim.dayLen);
    const seen = (x0: number, x1: number, y0: number, y1: number) => x1 >= cx && x0 <= cx + VIEW_W && y1 >= cy && y0 <= cy + VIEW_H;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLEAR; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (all) drawSky(ctx, read, this.camX, this.camY, WORLD_W);
    ctx.drawImage(this.building, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-cx, -cy);
    if (all) drawLights(ctx, this.sim.rooms, read);
    ctx.restore();
    // the names are on the walls: under the lift's car and the cast, so a name never covers a face (a keeper passing
    // under the Lamp Dorm's plate hides part of it for a moment instead)
    ctx.drawImage(this.plates, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-cx, -cy);
    drawLiftCar(ctx, this.sim.lift.y);
    // the eggs in their nests (on the building, under the cast)
    const hatchery = this.sim.rooms.find((r) => r.kind === 'hatchery');
    if (hatchery) for (const e of this.sim.eggs) {
      const x = nestX(hatchery, e.nest), y = feetY(hatchery.floor) - 12;
      if (seen(x - 8, x + 8, y - 16, y + 2)) drawEgg(ctx, e.element, x, y, this.progress(e), this.sim.tick);
    }
    // the cast, y-sorted by the feet; keepers stand a step behind the dragons they work with, so a dragon's head is
    // never covered (ART_BIBLE 1.4: nothing covers the eye) -- and one on a ladder, behind the dragons of both floors it
    // climbs between (sorted a step behind the upper floor's), so a head at a landing beside the ladder stays clear
    const cast: { y: number; pet?: Pet; view?: PetView; id?: number; keeper?: number }[] = [];
    for (const [id, v] of this.cast) { const p = v.pet, [a, b] = extentX(p); if (seen(a - 24, b + 24, p.y - 110, p.y + 12)) cast.push({ y: p.y, pet: p, view: v, id }); }
    this.sim.keepers.forEach((k, i) => {
      const y = k.climbing ? k.y : k.y - 3, key = k.climbing && k.legs.length ? Math.min(k.y, feetY(Math.max(k.f, k.legs[0].f))) - 3 : y;
      if (seen(k.x - 30, k.x + 30, y - 100, y + 8)) cast.push({ y: key, keeper: i });
    });
    cast.sort((a, b) => a.y - b.y);
    this.budget.begin(cast.filter((c) => c.pet).length, this.frame);
    let slot = 0;
    this.heads.clear();
    const head = { x: 0, y: 0 }, eyes: { x: number; y: number; w: number; h: number }[] = [];
    for (const c of cast) {
      if (c.pet) {
        const p = c.pet;
        // (a dragon that has just grown up is drawn flat in its glow's highlight inside its own ink: the grow-up's flash,
        // ART_BIBLE 4.2 -- the one flash the base draws)
        drawDragon(ctx, p.rig, p.player.pose, petOpts(p, { still: true, top: this.top, budget: this.budget, slot: slot++, flat: !!c.view && c.view.flash > 0 }));
        if (p.bowl) drawBowl(ctx, p);
        rootToScreen(p.rig, p.rig.j.cran.x, p.rig.j.cran.y, head);
        this.heads.set(c.id!, { x: head.x - cx, y: head.y - cy });
        if (this.hatches.length) { rootToScreen(p.rig, p.rig.j.eye.x, p.rig.j.eye.y, head); eyes.push({ x: head.x - 6, y: head.y - 6, w: 12, h: 12 }); }
      } else if (c.keeper != null) drawKeeperVisual(ctx, this.keeperAgents[c.keeper], this.sim.keepers[c.keeper]);
    }
    // a hatch's shell bits jump out of the nest over the baby standing up in it -- never over an eye
    for (const h of this.hatches) drawShellBits(ctx, h.el, h.x, h.y, h.age, eyes);
    this.top.flush(ctx);
    // the bubbles: each awake dragon's most pressing job that no one is at work on yet
    this.bubbles = [];
    const pt = { x: 0, y: 0 };
    for (const d of this.sim.dragons) {
      if (d.act && d.act.need === 'sleep') continue;
      const j = this.waitingJob(d), v = this.cast.get(d.id);
      if (!j || !v) continue;
      const p = v.pet, J = p.rig.j;
      rootToScreen(p.rig, J.cran.x, J.top, pt);
      if (!seen(pt.x - 24, pt.x + 24, pt.y - 34, pt.y)) continue;
      this.bubbles.push({ job: j, r: drawBubble(ctx, pt.x, pt.y - 2, j.need, tierOf(d.needs[j.need]), !!j.keeper) });
    }
    ctx.restore();
    this.chips = [];
    if (all) {
      this.hud(ctx, read);
      if (this.toast) drawToast(ctx, this.toast.text);
    }
    if (typeof window !== 'undefined' && window.__dragonCare) {
      const st = this.sim.stats;
      window.__dragonCare.base = { tick: this.sim.tick, camX: this.camX, camY: this.camY, jobs: this.sim.jobs.length, done: st.done, rushes: st.rushes, preempted: st.preempted,
        chips: this.chips.map((c) => ({ ...c.r, dragon: c.job.dragon.name, need: c.job.need, rushed: c.job.rushed })),
        digest: fnv1a(worldKey(this.sim)),
        barnDigest: fnv1a(barnKey(this.sim)),
        clock: { day: read.day, hour: read.hour, minute: read.minute, phase: read.phase },
        speed: this.speed,
        persist: this.persist,
        buttons: { ...BUTTONS },
        dragons: this.sim.dragons.map((d) => ({ id: d.id, name: d.name, element: d.element, stage: d.stage, f: d.f, x: d.x, move: d.move,
          room: this.sim.rooms.find((r) => r.floor === d.f && d.x >= r.x0 && d.x <= r.x1)?.kind ?? null,
          slot: d.slot ? `${this.sim.rooms[d.slot.room].kind}:${d.slot.i}` : null,
          waiting: !!this.waitingJob(d), head: this.heads.get(d.id) ?? null })),
        lift: { y: this.sim.lift.y, rider: this.sim.lift.rider },
        walked: st.dragonWalked,
        eggs: this.sim.eggs.map((e) => ({ element: e.element, nest: e.nest, progress: this.progress(e) })),
        card: this.cardDragon()?.name ?? null };
    }
  }

  /** How far on an egg is: 0 laid, 1 due (its HATCH_DAYS in the nest; one past it waits for a sub-slot at 1). */
  private progress(e: { laid: number }): number { return Math.max(0, Math.min(1, (this.sim.clock - e.laid) / (HATCH_DAYS * this.sim.dayLen))); }

  /** The dragon whose card is open, if it is still in the world (null: none). */
  private cardDragon(): Dragon | null { return this.card == null ? null : this.sim.dragons.find((d) => d.id === this.card) ?? null; }

  /**
   * The HUD (4.8): the top bar (the time, the jobs, the keepers' badges, NEW, pause and the speed: hud.ts), the job
   * strip along the bottom, the two gestures at the bottom right, and a dragon's card if one is open.
   */
  private hud(ctx: CanvasRenderingContext2D, read: ClockRead): void {
    const text = (s: string, x: number, y: number, color: string) => drawText(ctx, s, x, y, { color, shadow: false });
    drawTopBar(ctx, { clock: read, jobs: this.sim.jobs.length, keepers: this.sim.keepers.map((k) => ({ name: k.name, look: k.look, busy: !!k.job })),
      speed: this.speed, rate: this.rate, armed: this.newArmed > 0 });
    const q = this.sim.queue(), y = VIEW_H - 21;
    let x = 6;
    q.slice(0, STRIP).forEach((j, i) => {
      const w = drawChip(ctx, x, y, i + 1, j.need, j.dragon.name, tierOf(j.dragon.needs[j.need]), !!j.keeper, j.rushed);
      this.chips.push({ job: j, r: { x, y, w, h: 17 } });
      x += w + 3;
    });
    if (q.length > STRIP) {
      const s = `+${q.length - STRIP}`;
      ctx.fillStyle = INK; ctx.fillRect(x, y, 6 * s.length + 7, 17);
      text(s, x + 4, y + 5, '#f3e6c8');
      x += 6 * s.length + 7;
    }
    drawHint(ctx, x);
    const d = this.cardDragon();
    if (d) {
      const needs = Object.fromEntries(NEEDS.map((k) => [k, hasNeed(d.element, k) ? d.needs[k] : null])) as Record<NeedKind, number | null>;
      drawCard(ctx, { name: d.name, element: d.element, stage: d.stage, day: Math.floor((this.sim.clock - d.stageSince) / this.sim.dayLen) + 1, needs });
    }
  }

  /** Show a toast (it replaces the one showing). */
  private say(text: string): void { this.toast = { text, left: TOAST_FRAMES }; }

  /** Pick a speed (1, 2, 4 or 8 steps a frame), playing; pause and play. */
  private setRate(r: Rate): void { this.rate = r; this.paused = false; }
  private togglePause(): void { this.paused = !this.paused; }

  /** A top-bar button: NEW (asked twice), pause, the speed (the next of 1x, 2x, 4x, 8x). */
  private press(b: ButtonName): void {
    if (b === 'pause') this.togglePause();
    else if (b === 'speed') this.setRate(RATES[(RATES.indexOf(this.rate) + 1) % RATES.length]);
    else if (this.newArmed <= 0) { this.newArmed = NEW_FRAMES; this.say('SURE? TAP AGAIN'); }
    else this.newBarn();
  }

  /**
   * NEW, asked twice: a new barn (the new game, on a fresh seed -- the one place the game draws a seed from the wall
   * clock's randomness: rng.ts freshSeed), at 1x; a page that saves forgets the old barn and keeps the new one.
   */
  private newBarn(): void {
    this.newArmed = 0;
    this.use(buildSim(startSpec(null), freshSeed()));
    this.rate = 1; this.paused = false;
    if (this.persist) { clearSave(); this.save(); }
    this.say('A NEW BARN');
  }

  /** Keep the barn (a page that saves: storage.ts). */
  private save(): void { if (this.persist) writeSave(serialize(this.sim)); }

  // ---------- input ----------

  private setCam(x: number, y: number): void {
    this.camX = clamp(x, 0, WORLD_W - VIEW_W);
    this.camY = clamp(y, 0, WORLD_H - VIEW_H);
  }

  /**
   * A tap: a top-bar button first (the rest of the bar takes the tap too: it covers the world there); then an open
   * dragon card closes (it covers the world there too); a job chip rushes its job and brings its dragon into view; a
   * bubble, or the dragon itself, rushes its job -- and a dragon with no job waiting opens its card. A tap on anything
   * else closes the card (the buttons leave it open: the game can be paused to read it).
   */
  tap(sx: number, sy: number): void {
    if (this.layers === 'all') {
      const b = buttonAt(sx, sy);
      if (b) { this.press(b); return; }
      if (sy < BAR_H) return;
      if (this.cardDragon() && hit(CARD, sx, sy)) { this.card = null; return; }
    }
    this.card = null;
    for (const c of this.chips) if (hit(c.r, sx, sy)) { this.sim.rush(c.job); this.focus(c.job.dragon); return; }
    const wx = sx + Math.round(this.camX), wy = sy + Math.round(this.camY);
    // (the top-most bubble first: later ones are drawn over earlier ones)
    for (let i = this.bubbles.length - 1; i >= 0; i--) { const b = this.bubbles[i]; if (hit(b.r, wx, wy)) { this.sim.rush(b.job); return; } }
    const pt = { x: 0, y: 0 };
    for (let i = this.sim.dragons.length - 1; i >= 0; i--) {
      const d = this.sim.dragons[i], v = this.cast.get(d.id);
      if (!v) continue;
      const p = v.pet, [a, b] = extentX(p);
      rootToScreen(p.rig, p.rig.j.cran.x, p.rig.j.top, pt);
      if (wx < a || wx > b || wy < pt.y || wy > p.y + 4) continue;
      const j = this.waitingJob(d);
      if (j) this.sim.rush(j);
      else this.card = d.id;
      return;
    }
  }

  /** Ease the camera to a dragon. */
  private focus(d: Dragon): void {
    this.camTo = { x: clamp(d.x - VIEW_W / 2, 0, WORLD_W - VIEW_W), y: clamp(this.feet(d) - VIEW_H * 0.6, 0, WORLD_H - VIEW_H) };
  }

  /**
   * Live only: size the canvas to the window (whole pixels); take the pointer -- drag to pan, tap to Rush or press a
   * button -- and the keys (1-4 the speed, p pause). A page that may save loads the player's barn now (one that didn't
   * fit -- another version, not a save, or a save whose insides the view can't build, step or draw: load() -- is kept
   * aside at the backup key and the page's new barn plays on, with a toast), saves every 600 frames and when it is
   * hidden or left, and lends the page window.__dragonCare.baseSaveNow.
   */
  attach(canvas: HTMLCanvasElement): void {
    if (this.persist) {
      const { save, note } = loadSave();
      if (save) {
        if (!this.load(save)) { backupSave(); this.say(DIDNT_FIT); }
      } else if (note === 'old' || note === 'bad') this.say(DIDNT_FIT);
      this.saving = true;
      const onHide = () => { if (document.visibilityState === 'hidden') this.save(); };
      const onLeave = () => this.save();
      document.addEventListener('visibilitychange', onHide);
      addEventListener('pagehide', onLeave);
      if (window.__dragonCare) window.__dragonCare.baseSaveNow = () => { this.save(); return this.sim.tick; };
      this.detachers.push(() => {
        this.saving = false;
        document.removeEventListener('visibilitychange', onHide);
        removeEventListener('pagehide', onLeave);
        if (window.__dragonCare) delete window.__dragonCare.baseSaveNow;
      });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) this.setRate(RATES[i]);
      else if (e.key === 'p' || e.key === 'P') this.togglePause();
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    this.detachers.push(() => removeEventListener('keydown', onKey));
    const fit = () => {
      const s = Math.max(1, Math.floor(Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H)));
      canvas.style.width = `${VIEW_W * s}px`; canvas.style.height = `${VIEW_H * s}px`;
    };
    fit();
    let down: { x: number; y: number; camX: number; camY: number; drag: boolean } | null = null;
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
    };
    const onDown = (e: PointerEvent) => { down = { ...at(e), camX: this.camX, camY: this.camY, drag: false }; this.camTo = null; canvas.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const p = at(e);
      if (!down.drag && Math.hypot(p.x - down.x, p.y - down.y) > DRAG_PX) down.drag = true;
      if (down.drag) this.setCam(down.camX - (p.x - down.x), down.camY - (p.y - down.y));
    };
    const onUp = (e: PointerEvent) => { if (down && !down.drag) { const p = at(e); this.tap(p.x, p.y); } down = null; };
    const onCancel = () => { down = null; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    addEventListener('resize', fit);
    this.detachers.push(() => {
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel);
      removeEventListener('resize', fit);
      canvas.style.width = ''; canvas.style.height = '';
    });
  }

  /** Give the page back: the pointer, the keys, the resize, the saving, and the hook (it describes a base that is running). */
  detach(): void {
    for (const f of this.detachers) f();
    this.detachers = [];
    if (typeof window !== 'undefined' && window.__dragonCare) delete window.__dragonCare.base;
  }
}
