// The base, live (docs/BASE_DESIGN.md 2, 4): the greybox barn and towers at 1x with the care simulation (sim.ts)
// running underneath -- its dragons on the real rig, its keepers on the engine's paper doll -- the need bubbles, the
// job strip, and two inputs: drag to look around, and tap a bubble, a job or a dragon to Rush it. A gallery scene
// (view=base in src/gallery.ts), so the frozen-time contract holds: t= steps the world t times and draws that frame.
// The world is built from a start (src/game/presets.ts: the new game, or a preset); its dragons are drawn by a cast
// keyed by dragon id, which follows the simulation as dragons come, go and grow. The simulation walks the dragons to
// their needs' rooms and rides them on the Dragon Lift (travel.ts); the view puts each pet where its dragon is, plays
// its walk from the start of every walk bout at speed 1 (the sim moved it by that walk's own root motion, so the paws
// stay planted), narrows it through a paper turn, and draws the lift's car where the car is. The constructor never
// touches storage; a live page that may save (opts.persist) will load in attach() (S4).
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
import { worldKey, fnv1a } from './save.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { WORLD_W, WORLD_H, feetY } from './layout.ts';
import { walking, feetOf } from './travel.ts';
import { gaitOf, wrapT } from './gait.ts';
import { SOON, tierOf, chargeOf } from './needs.ts';
import type { NeedKind } from './needs.ts';
import { drawBuilding, drawPlates, drawLiftCar } from './building.ts';
import { makeKeeperAgent, stepKeeperVisual, drawKeeperVisual } from './people.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { drawBubble, drawChip, hit } from './icons.ts';
import type { Rect } from './icons.ts';

const INK = '#1a1018';
export const VIEW_W = 640, VIEW_H = 360;
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

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** How a base view starts: the world's seed, where the camera starts (world px, clamped), a preset, and whether it may save. */
export interface BaseViewOpts {
  seed: number;
  cam?: { x: number; y: number } | null;
  /** A start from presets.ts by name (null, or a name no preset has: the new game). */
  preset?: string | null;
  /** A live page that loads and autosaves (the gallery sets it only without t=, save=0 or preset=). Unused until S4. */
  persist?: boolean;
}

/**
 * One dragon on screen: its pet, playing its wake before it goes back to idle, its eat bowl (found once), the stage it
 * was built at, and the walk bout its walk anim was started for (-1: none yet; travel.ts Dragon.walkSeq).
 */
export interface PetView {
  pet: Pet;
  waking: boolean;
  bowl: { x: number; h: number; w: number } | null;
  stage: Stage;
  walkSeq: number;
}

export class BaseView {
  readonly w = VIEW_W;
  readonly h = VIEW_H;
  readonly sim: CareSim;
  /** The dragons on screen, by dragon id, in id order (syncCast keeps it matched to the simulation). */
  readonly cast = new Map<number, PetView>();
  /** Whether this page may load and autosave (S4). */
  readonly persist: boolean;
  camX = START_CAM.x;
  camY = START_CAM.y;
  /** Where the camera is easing to after a job chip was tapped (null: it stays put). */
  private camTo: { x: number; y: number } | null = null;
  private readonly keeperAgents: KeeperAgent[];
  private readonly building: HTMLCanvasElement;
  private readonly plates: HTMLCanvasElement;
  private readonly top = new TopPass(160);
  private readonly budget = new AmbientBudget();
  private frame = 0;
  /** Last frame's bubbles (world px) and chips (screen px), for tapping. */
  private bubbles: { job: Job; r: Rect }[] = [];
  private chips: { job: Job; r: Rect }[] = [];
  private detachers: (() => void)[] = [];

  constructor(opts: BaseViewOpts) {
    this.sim = buildSim(startSpec(opts.preset), opts.seed);
    this.persist = !!opts.persist;
    if (opts.cam) this.setCam(opts.cam.x, opts.cam.y);
    this.syncCast();
    this.keeperAgents = this.sim.keepers.map((k) => makeKeeperAgent(k.look));
    this.building = drawBuilding(this.sim.rooms);
    this.plates = drawPlates(this.sim.rooms);
  }

  /** Every dragon's pet, in id order. */
  get pets(): Pet[] { return [...this.cast.values()].map((v) => v.pet); }

  /**
   * A dragon's feet: on the lift's car while it rides, else its floor's straw band, a px apart from its neighbours' so
   * the y-sort never ties -- and waiting in a landing's line deeper, a px more per place, so each one waiting is drawn
   * over the ones ahead of it and the dragons in the slots, whose eyes its place keeps clear (travel.ts feetOf).
   */
  private feet(d: Dragon): number { return feetOf(this.sim, d); }

  /**
   * Match the cast to the simulation's dragons: a pet for a dragon it hasn't seen, none for one that's gone, and a
   * new one for a dragon that has grown into another stage (a new rig: its stage's proportions and anims).
   */
  private syncCast(): void {
    const ids = new Set<number>();
    for (const d of this.sim.dragons) {
      ids.add(d.id);
      const v = this.cast.get(d.id);
      if (v && v.stage === d.stage) continue;
      const pet = makePet(d.element, d.stage, d.seed, 'idle', d.x, this.feet(d), { facing: d.facing, mood: v ? v.pet.mood : d.mood });
      this.cast.set(d.id, { pet, waking: false, bowl: null, stage: d.stage, walkSeq: -1 });
    }
    for (const id of this.cast.keys()) if (!ids.has(id)) this.cast.delete(id);
  }

  // ---------- a step ----------

  step(): void {
    this.sim.step();
    this.syncCast();
    for (const d of this.sim.dragons) this.sync(d, this.cast.get(d.id)!);
    const pets = this.pets;
    stepWary(pets);
    for (const p of pets) stepPet(p);
    this.sim.keepers.forEach((k, i) => stepKeeperVisual(this.keeperAgents[i], k, k.climbing ? k.y : k.y - 3));
    if (this.camTo) {
      this.setCam(this.camX + (this.camTo.x - this.camX) / 6, this.camY + (this.camTo.y - this.camY) / 6);
      if (Math.abs(this.camTo.x - this.camX) < 0.5 && Math.abs(this.camTo.y - this.camY) < 0.5) { this.setCam(this.camTo.x, this.camTo.y); this.camTo = null; }
    }
    this.frame++;
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
      const want = this.animFor(d);
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

  draw(ctx: CanvasRenderingContext2D): void {
    const cx = Math.round(this.camX), cy = Math.round(this.camY);
    const seen = (x0: number, x1: number, y0: number, y1: number) => x1 >= cx && x0 <= cx + VIEW_W && y1 >= cy && y0 <= cy + VIEW_H;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.building, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    // the names are on the walls: under the lift's car and the cast, so a name never covers a face (a keeper passing
    // under the Lamp Dorm's plate hides part of it for a moment instead)
    ctx.drawImage(this.plates, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-cx, -cy);
    drawLiftCar(ctx, this.sim.lift.y);
    // the cast, y-sorted by the feet; keepers stand a step behind the dragons they work with, so a dragon's head is
    // never covered (ART_BIBLE 1.4: nothing covers the eye) -- and one on a ladder, behind the dragons of both floors it
    // climbs between (sorted a step behind the upper floor's), so a head at a landing beside the ladder stays clear
    const cast: { y: number; pet?: Pet; keeper?: number }[] = [];
    for (const { pet: p } of this.cast.values()) { const [a, b] = extentX(p); if (seen(a - 24, b + 24, p.y - 110, p.y + 12)) cast.push({ y: p.y, pet: p }); }
    this.sim.keepers.forEach((k, i) => {
      const y = k.climbing ? k.y : k.y - 3, key = k.climbing && k.legs.length ? Math.min(k.y, feetY(Math.max(k.f, k.legs[0].f))) - 3 : y;
      if (seen(k.x - 30, k.x + 30, y - 100, y + 8)) cast.push({ y: key, keeper: i });
    });
    cast.sort((a, b) => a.y - b.y);
    this.budget.begin(cast.filter((c) => c.pet).length, this.frame);
    let slot = 0;
    for (const c of cast) {
      if (c.pet) {
        const p = c.pet;
        drawDragon(ctx, p.rig, p.player.pose, petOpts(p, { still: true, top: this.top, budget: this.budget, slot: slot++ }));
        if (p.bowl) drawBowl(ctx, p);
      } else if (c.keeper != null) drawKeeperVisual(ctx, this.keeperAgents[c.keeper], this.sim.keepers[c.keeper]);
    }
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
    this.hud(ctx);
    if (typeof window !== 'undefined' && window.__dragonCare) {
      const st = this.sim.stats;
      window.__dragonCare.base = { tick: this.sim.tick, camX: this.camX, camY: this.camY, jobs: this.sim.jobs.length, done: st.done, rushes: st.rushes, preempted: st.preempted,
        chips: this.chips.map((c) => ({ ...c.r, dragon: c.job.dragon.name, need: c.job.need, rushed: c.job.rushed })),
        digest: fnv1a(worldKey(this.sim)),
        dragons: this.sim.dragons.map((d) => ({ id: d.id, name: d.name, element: d.element, stage: d.stage, f: d.f, x: d.x, move: d.move,
          room: this.sim.rooms.find((r) => r.floor === d.f && d.x >= r.x0 && d.x <= r.x1)?.kind ?? null,
          slot: d.slot ? `${this.sim.rooms[d.slot.room].kind}:${d.slot.i}` : null })),
        lift: { y: this.sim.lift.y, rider: this.sim.lift.rider },
        walked: st.dragonWalked };
    }
  }

  /** The top bar (jobs, busy keepers, the two gestures) and the job strip along the bottom (4.8). */
  private hud(ctx: CanvasRenderingContext2D): void {
    const text = (s: string, x: number, y: number, color: string, align: 'left' | 'right' = 'left') => drawText(ctx, s, x, y, { color, align, shadow: false });
    ctx.fillStyle = INK; ctx.fillRect(0, 0, VIEW_W, 15);
    const busy = this.sim.keepers.filter((k) => k.job).length;
    text(`JOBS ${this.sim.jobs.length}`, 6, 4, '#f3e6c8');
    text(`KEEPERS ${busy} OF ${this.sim.keepers.length} BUSY`, 64, 4, '#f3e6c8');
    text('DRAG: LOOK AROUND   TAP A BUBBLE: RUSH', VIEW_W - 6, 4, '#b8ac8e', 'right');
    this.chips = [];
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
    }
  }

  // ---------- input ----------

  private setCam(x: number, y: number): void {
    this.camX = clamp(x, 0, WORLD_W - VIEW_W);
    this.camY = clamp(y, 0, WORLD_H - VIEW_H);
  }

  /** A tap: a job chip rushes its job and brings its dragon into view; a bubble, or the dragon itself, rushes its job. */
  tap(sx: number, sy: number): void {
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
      return;
    }
  }

  /** Ease the camera to a dragon. */
  private focus(d: Dragon): void {
    this.camTo = { x: clamp(d.x - VIEW_W / 2, 0, WORLD_W - VIEW_W), y: clamp(this.feet(d) - VIEW_H * 0.6, 0, WORLD_H - VIEW_H) };
  }

  /** Live only: size the canvas to the window (whole pixels) and take the pointer -- drag to pan, tap to Rush. */
  attach(canvas: HTMLCanvasElement): void {
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

  /** Give the page back: the pointer and the resize, and the hook (it describes a base that is running). */
  detach(): void {
    for (const f of this.detachers) f();
    this.detachers = [];
    if (typeof window !== 'undefined' && window.__dragonCare) delete window.__dragonCare.base;
  }
}
