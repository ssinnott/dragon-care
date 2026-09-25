// The base, live (docs/BASE_DESIGN.md 2, 4): the greybox barn and towers at 1x with the care simulation (sim.ts)
// running underneath -- its dragons on the real rig, its keepers on the engine's paper doll -- the need bubbles, the
// job strip, and two inputs: drag to look around, and tap a bubble, a job or a dragon to Rush it. A gallery scene
// (view=base in src/gallery.ts), so the frozen-time contract holds: t= steps the world t times and draws that frame.
// The world is built from a start (src/game/presets.ts: the new game, or a preset); its dragons are drawn by a cast
// keyed by dragon id, which follows the simulation as dragons come, go and grow. The constructor never touches
// storage; a live page that may save (opts.persist) will load in attach() (S4).
import { drawDragon, rootToScreen } from '../art/dragon/rig.ts';
import { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { ELEMENT_ANIM_FALLBACK } from '../art/dragon/anims.ts';
import { drawText } from '../lib/engine/text.ts';
import { makePet, petOpts, stepPet, stepWary, extentX, bowlFor, drawBowl } from './pet.ts';
import type { Pet } from './pet.ts';
import { CareSim } from './sim.ts';
import type { Dragon, Job } from './sim.ts';
import { startSpec, buildSim } from './presets.ts';
import { worldKey, fnv1a } from './save.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { WORLD_W, WORLD_H, HOIST_CX, feetY } from './layout.ts';
import { SOON, tierOf, chargeOf } from './needs.ts';
import type { NeedKind } from './needs.ts';
import { drawBuilding, drawPlates, drawHoistCar } from './building.ts';
import { makeKeeperAgent, stepKeeperVisual, drawKeeperVisual } from './people.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { drawBubble, drawChip, hit } from './icons.ts';
import type { Rect } from './icons.ts';

const INK = '#1a1018';
export const VIEW_W = 640, VIEW_H = 360;
/** Where the camera starts: the left tower, the kitchen, the hatchery, the romp room and the sun loft. */
const START_CAM = { x: 48, y: 376 };
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
  /** A live page that loads and autosaves (the gallery sets it only without t= and without save=0). Unused until S4. */
  persist?: boolean;
}

/** One dragon on screen: its pet, playing its wake before it goes back to idle, its eat bowl (found once), and the stage it was built at. */
export interface PetView {
  pet: Pet;
  waking: boolean;
  bowl: { x: number; h: number; w: number } | null;
  stage: Stage;
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
  /** The hoist car's floor, world y: it rides with whoever is on it and waits where they left it. */
  private carY = feetY(0);
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

  /** A dragon's feet: its floor's straw band, a px apart from its neighbours' so the y-sort never ties. */
  private feet(d: Dragon): number { return feetY(d.f, (d.id % 3) - 1); }

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
      this.cast.set(d.id, { pet, waking: false, bowl: null, stage: d.stage });
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
    this.sim.keepers.forEach((k, i) => {
      if (k.climbing && Math.abs(k.x - HOIST_CX) < 1) this.carY = k.y;
      stepKeeperVisual(this.keeperAgents[i], k, k.climbing ? k.y : k.y - 3);
    });
    if (this.camTo) {
      this.setCam(this.camX + (this.camTo.x - this.camX) / 6, this.camY + (this.camTo.y - this.camY) / 6);
      if (Math.abs(this.camTo.x - this.camX) < 0.5 && Math.abs(this.camTo.y - this.camY) < 0.5) { this.setCam(this.camTo.x, this.camTo.y); this.camTo = null; }
    }
    this.frame++;
  }

  /** What a dragon's anim should be: its job's while a keeper is at work with it, its tell while it waits, else idle. */
  private animFor(d: Dragon): string {
    if (d.act) return d.act.need === 'sleep' && d.element === 'dusk' ? 'tuckin' : ACT_ANIM[d.act.need];
    const j = this.waitingJob(d);
    // the hungry tell (4.2), and slinkwing's lonely call (3.7)
    if (j && j.need === 'food' && d.needs.food < SOON) return 'beg';
    if (j && j.need === 'love' && d.element === 'slinkwing' && d.needs.love < SOON) return 'call';
    return 'idle';
  }

  /** Point a pet at its dragon: its anim (a sleeper wakes before it idles), its bowl at a meal, its mood and charge. */
  private sync(d: Dragon, v: PetView): void {
    const p = v.pet, want = this.animFor(d);
    if (v.waking && p.player.done) { v.waking = false; p.player.play('idle', { blend: 8 }); p.anim = 'idle'; }
    if (want !== p.anim && !(v.waking && want === 'idle')) {
      if ((p.anim === 'sleep' || p.anim === 'tuckin') && want === 'idle') { p.player.play('wake', { blend: 8 }); p.anim = 'wake'; v.waking = true; }
      else { p.player.play(want, { blend: 8, fallback: ELEMENT_ANIM_FALLBACK[want] }); p.anim = want; v.waking = false; }
      p.hold = 0;
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
    ctx.save();
    ctx.translate(-cx, -cy);
    drawHoistCar(ctx, this.carY);
    // the cast, y-sorted by the feet; keepers stand a step behind the dragons they work with, so a dragon's head is
    // never covered (ART_BIBLE 1.4: nothing covers the eye)
    const cast: { y: number; pet?: Pet; keeper?: number }[] = [];
    for (const { pet: p } of this.cast.values()) { const [a, b] = extentX(p); if (seen(a - 24, b + 24, p.y - 110, p.y + 12)) cast.push({ y: p.y, pet: p }); }
    this.sim.keepers.forEach((k, i) => { const y = k.climbing ? k.y : k.y - 3; if (seen(k.x - 30, k.x + 30, y - 100, y + 8)) cast.push({ y, keeper: i }); });
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
    ctx.drawImage(this.plates, cx, cy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    this.hud(ctx);
    if (typeof window !== 'undefined' && window.__dragonCare) {
      const st = this.sim.stats;
      window.__dragonCare.base = { tick: this.sim.tick, camX: this.camX, camY: this.camY, jobs: this.sim.jobs.length, done: st.done, rushes: st.rushes, preempted: st.preempted,
        chips: this.chips.map((c) => ({ ...c.r, dragon: c.job.dragon.name, need: c.job.need, rushed: c.job.rushed })),
        digest: fnv1a(worldKey(this.sim)),
        dragons: this.sim.dragons.map((d) => ({ id: d.id, name: d.name, element: d.element, stage: d.stage, f: d.f, x: d.x })) };
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
    for (const b of this.bubbles) if (hit(b.r, wx, wy)) { this.sim.rush(b.job); return; }
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

  detach(): void { for (const f of this.detachers) f(); this.detachers = []; }
}
