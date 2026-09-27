// The base, live (docs/BASE_DESIGN.md): the barn and towers at 1x with the care simulation (sim.ts) running underneath,
// drawn and driven. A gallery scene (view=base in src/gallery.ts), so the frozen-time contract holds: t= steps the world
// t times at 1x and draws that frame. The constructor never touches storage: a live page that may save loads the
// player's barn in attach() and saves it as it goes (storage.ts; BASE_DESIGN 7, Saves), and a frozen page never calls
// attach(). The world is built from a start (presets.ts: the new game, or a preset). What the view owns:
// - The camera: dragged, eased to the Map Room, the Aerie or a keeper taken, following the keeper held; out to the
//   garden's end, which moves east as elders retire (BASE_DESIGN 4.8, 4.10).
// - The cast: a pet per dragon (by id) on the real rig, rebuilt as it grows, put where its dragon is, playing its walk
//   at the speed the simulation walked it (the lively step: BASE_DESIGN 2), its paper turn, its act's anim, a
//   grow-up's flash and `happy` (BASE_DESIGN 7), a resident's naps, sits and strolls (3, The Garden); the keepers as
//   their characters (people.ts); the lift's car, the eggs and a hatch's shell bits -- drawn y-sorted, the keepers a
//   step behind the dragons beside them, so nothing covers a dragon's eye (ART_BIBLE 1.4).
// - Time: 0, 1, 2, 4 or 8 world steps a frame (the speed is the view's own: a save has none); the sky, the lights and
//   the moonlit walls by the clock, never on a dragon or a floor (BASE_DESIGN 7; layers=cast draws the cast alone).
// - The HUD (hud.ts): the top bar, the job strip, the bubbles, the hints, the toasts (life's news waits its turn), a
//   dragon's card, the TEAM OUT chip, and while a keeper is held the pad and the action line (BASE_DESIGN 4.8, 4.10).
// - The overlays, one `ui.screen` (none, map, mission or watch): the Map Room's table (maptable.ts; the world waits
//   under it) and the watch overlay (missionview.ts; the world steps on). An open overlay takes every tap under the top
//   bar before the pad and the world; the top bar's buttons still work; a badge, Tab or Esc goes back to the barn; a
//   keeper held stays held but stands still under it (BASE_DESIGN 5, 6).
// - Input: taps (tap: in its order), drags, the keys and the touch pad. Everything that changes the world -- a take, a
//   steer, E, a send -- goes to the simulation as a command, applied at the start of its next step (control.ts).
import { drawDragon, rootToScreen } from '../art/dragon/rig.ts';
import { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { ELEMENT_ANIM_FALLBACK } from '../art/dragon/anims.ts';
import { drawText, measureText } from '../lib/engine/text.ts';
import { resetChain } from '../lib/art/secondary.ts';
import { makePet, petOpts, stepPet, stepWary, extentX, bowlFor, drawBowl } from './pet.ts';
import type { Pet } from './pet.ts';
import { CareSim } from './sim.ts';
import type { Dragon, Job, Keeper } from './sim.ts';
import { startSpec, buildSim, tripStart } from './presets.ts';
import type { Trip } from './trip.ts';
import { sceneAt, drawMissionScene, drawBackButton, drawResultCard, resultTitle, ScenePets, BACK_BUTTON, RESULT_CARD, ROAD_BOTTOM } from './missionview.ts';
import type { SceneFrame } from './missionview.ts';
import { worldKey, barnKey, fnv1a, serialize } from './save.ts';
import type { SaveV } from './save.ts';
import { readClock, hourSteps, PHASE_HOURS, HATCH_DAYS } from './clock.ts';
import type { Speed, ClockRead } from './clock.ts';
import { drawSky } from './sky.ts';
import { drawTopBar, drawToast, drawHint, HINT_TAPS, drawCard, buttonAt, badgeAt, padAt, drawPad, drawActionLine, drawPortraitHint, BUTTONS, BAR_H, TOAST_FRAMES, CARD, cardAt, PAD, PAD_DIR,
  BADGE_X0, BADGE_DX, BADGE_W, BADGE_Y, BADGE_H } from './hud.ts';
import type { ButtonName, PadButton, BadgeState } from './hud.ts';
import { actionFor, controlledKeeper, takeRefusal, SUPPLY_NAME } from './control.ts';
import type { Command } from './control.ts';
import { loadSave, writeSave, clearSave, backupSave } from './storage.ts';
import { freshSeed } from '../lib/engine/rng.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { WORLD_W, WORLD_H, NESTS, feetY, nestX, eggBottom } from './layout.ts';
import { drawGarden, drawGardenLights, drawGardenPlate } from './gardenArt.ts';
import { lightsOf } from './sky.ts';
import { drawEgg, drawShellBits, drawWaiting, BITS_FRAMES } from './eggs.ts';
import { stageDue, staysOn, barnCount, barnFull, BARN_CAP } from './life.ts';
import { walking, feetOf } from './travel.ts';
import { gaitOf, wrapT } from './gait.ts';
import { NEEDS, GARDEN_NEEDS, SOON, tierOf, chargeOf, hasNeed } from './needs.ts';
import type { NeedKind } from './needs.ts';
import { drawBuilding, drawPlates, drawLiftCar, drawLights } from './building.ts';
import { makeKeeperAgent, stepKeeperVisual, drawKeeperVisual } from './people.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { drawBubble, drawChip, hit } from './icons.ts';
import type { Rect } from './icons.ts';
import { canSend, onTrip, LOST_NEST } from './missions.ts';
import { newUi, drawMapScreen, drawMissionScreen, editTeam, drawTeamChip, drawTripCard, drawLogButton, hitAt, chosen, eggNotice, tripProgress, TRIP_CARD, PANEL, LOG_BUTTON } from './maptable.ts';
import type { MapUi, Hit, Screen } from './maptable.ts';

const INK = '#1a1018';
export const VIEW_W = 640, VIEW_H = 360;
/** Behind everything (the page's own colour: index.html). */
const CLEAR = '#16141c';
/**
 * Where the camera starts: the barn's three floors and its west half -- the Hatchery and the hayloft's kitchen, each
 * floor's Hearth Kitchen, the ground floor's Grooming Parlour, the Romp Room, the Dragon Lift (its car starts at the
 * ground floor), the ladder bay and the first module east of it (the Bathhouse, the upper and the hayloft's Grooming
 * Parlours) -- framed on the start (BASE_DESIGN 3's rooms): six of the seven young adults, EMBER facing its hearth, BRAMBLE,
 * ZAP, RIPPLE, COBBLE and ECHO, span world x 199.5-842.8 (measured over their idles), 3 px more than a screen, so the
 * frame starts at 201: every face whole, the tips of EMBER's and COBBLE's snouts (under 2 px) at the edges, and every
 * plate in it whole (the kitchens' sit 44 px in from the barn's west wall: layout.ts platesOf). WICK, in the ground
 * floor's Lamp Dorm, is a drag away.
 */
const START_CAM = { x: 201, y: 376 };
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
/** The news when an egg falls due with the barn at its cap (life.ts BARN_CAP): it waits in its nest. */
const BARN_FULL = 'THE BARN IS FULL';
/**
 * A dragon that has just grown up is drawn flat (its glow's highlight, inside its ink) this many frames shown (ART_BIBLE
 * 4.2: the new silhouette's 12 f flash) -- frames, not world steps, so it lasts as long at 8x (paused, it holds).
 */
const GROW_FLASH = 12;
/** What a grow-up's toast calls the new stage, for one dragon and for more: "EMBER IS AN ELDER NOW!", "EMBER AND ZAP ARE ELDERS NOW!". */
const STAGE_NOW: Readonly<Record<Stage, string>> = Object.freeze({ baby: 'A BABY', young: 'YOUNG', adult: 'AN ADULT', elder: 'AN ELDER' });
const STAGES_NOW: Readonly<Record<Stage, string>> = Object.freeze({ baby: 'BABIES', young: 'YOUNG', adult: 'ADULTS', elder: 'ELDERS' });
/**
 * Life's news waiting for the toast: dragons that grew into a stage (together), elders who moved to the garden
 * (together), or a line (the dawn's tip).
 */
type News = { stage: Stage; names: string[] } | { garden: true; names: string[] } | { text: string };
/** The toast's line for a piece of news: one dragon grown up (or moved to the garden), two, or two named and how many more. */
function newsText(n: News): string {
  if ('text' in n) return n.text;
  const [a, b] = n.names, who = n.names.length === 1 ? a : n.names.length === 2 ? `${a} AND ${b}` : `${a}, ${b} AND ${n.names.length - 2} MORE`;
  if ('garden' in n) return `${who} MOVED TO THE GARDEN`;
  return n.names.length === 1 ? `${a} IS ${STAGE_NOW[n.stage]} NOW!` : `${who} ARE ${STAGES_NOW[n.stage]} NOW!`;
}
/** The dawn's tip looks this many game days ahead for stage-ups. */
const TIP_DAYS = 2;
/**
 * The camera follows the keeper held by hand, easing an eighth of the way a frame; a drag of the camera stops it
 * following for FOLLOW_PAUSE frames (3 s). Across, it keeps their feet between screen x 160 and 480. Up and down it
 * frames their floor: their feet at screen y FRAME_FEET (or as near as the world's edges let it: the ground floor's at
 * 296), so their mark and "?" (up to 108 px over the feet) stay clear of the top bar, the floor below stands with its
 * feet by y 308 and its heads (12-52 px over the feet, measured over every stage) clear of the pad's row (y 305) and the
 * line's (339), and the floor two below -- the ground floor, seen from the hayloft -- is off the screen's bottom but
 * for its feet, under the pad (ART_BIBLE 1.4: nothing over a dragon's eye; a box of y 90-270 let the hayloft's mark go
 * under the top bar and the ground floor's heads under the pad).
 */
const FOLLOW = { x0: 160, x1: 480 } as const, FRAME_FEET = 196, FOLLOW_EASE = 8, FOLLOW_PAUSE = 180;
/** A keeper's tap box (world px, around their feet): 10 px either side, from 78 px over the feet (Pip, the smallest, 58) to 2 under. */
const KEEPER_BOX = { half: 10, top: 78, topSmall: 58, below: 2 } as const;
/** How long each hint shows before the next (hintText), frames: 4 s. */
const HINT_FRAMES = 240;
/**
 * Where a keeper sorts in the cast's draw order (by the feet, dragons at theirs): a step behind the dragons of their
 * floor, so a dragon's head is never covered (ART_BIBLE 1.4) -- and one on a ladder behind the dragons of both floors
 * it climbs between (sorted a step behind the upper floor's), so a head at a landing beside the ladder stays clear.
 */
function castKey(k: Keeper): number {
  if (!k.climbing) return k.y - 3;
  return k.legs.length ? Math.min(k.y, feetY(Math.max(k.f, k.legs[0].f))) - 3 : k.y;
}
/** The keys that walk the keeper held by hand: WASD and the arrows. */
const DIR_KEYS: Readonly<Record<string, 'up' | 'down' | 'left' | 'right'>> = Object.freeze({
  w: 'up', W: 'up', ArrowUp: 'up', s: 'down', S: 'down', ArrowDown: 'down', a: 'left', A: 'left', ArrowLeft: 'left', d: 'right', D: 'right', ArrowRight: 'right',
});

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
  /** A live page that loads and autosaves in attach() (the gallery sets it only without t=, save=0, preset=, hour= or panel=). */
  persist?: boolean;
  /** The hour of day 1 the world starts at, 0-23 (null: 07:00, the new game's). A loaded save keeps its own clock (the gallery never has a page given an hour load). */
  hour?: number | null;
  /** A keeper to take at once, by name (take=bea: the world's first step takes them; a frozen page shows them held). */
  take?: string | null;
  /**
   * 'world': only the building (at the night's step), the lift's car, the cast, the bubbles and the plates -- no sky,
   * lights, HUD or toasts; 'cast': only the cast and the bubbles, on the page's flat colour (BASE_DESIGN 7's no-tint check:
   * every dragon pixel the same by day and by night).
   */
  layers?: Layers;
  /**
   * An overlay open from the start (panel=): the Map Room's map, or a mission's chooser -- `mission`, its place on the
   * board (0-2) -- opened at the first frame (BASE_DESIGN 5), or `watch`, the team out watched on its road (BASE_DESIGN 6).
   */
  panel?: 'map' | 'mission' | 'watch' | null;
  mission?: number | null;
  /** preset=trip's trip (trip=<region>:<progress>[:fail][:weak]) and the step it is to be at that progress (the frozen t=, else 0). */
  trip?: string | null;
  at?: number;
}

/** Where the Map Room's table is (world px: the left tower's floor 4); a tap on it opens the map. */
const TABLE: Readonly<Rect> = Object.freeze({ x: 70, y: 172, w: 60, h: 36 });
/**
 * Where the camera goes for the Map Room's table, and for the Aerie: one frame holds both, the deck with the team's
 * heads clear of the top bar and the Map Room under it (y 20, not 40: at 40 a rider's hat is under the bar).
 */
const MAP_CAM = { x: 0, y: 20 }, AERIE_CAM = { x: 0, y: 20 };
/** Frames the camera eases toward the Map Room before the map opens (MAP, M). */
const MAP_OPEN_FRAMES = 30;
/** A toast over the watch overlay: its text's top, on the verge under the road (y 306), clear of the buttons (y 338). */
const WATCH_TOAST_Y = ROAD_BOTTOM + 16;

/**
 * One dragon on screen: its pet, playing its wake before it goes back to idle, its eat bowl (found once), the stage it
 * was built at, the walk bout its walk anim was started for (-1: none yet; travel.ts Dragon.walkSeq), and after a
 * grow-up the frames of its flash left and whether its `happy` is still playing (cheering).
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

/** Which layers a base view draws (BaseViewOpts.layers). */
export type Layers = 'all' | 'world' | 'cast';

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
  readonly layers: Layers;
  /** World steps a frame while playing (the keys 1-4, the speed button), and whether it is paused (p, the pause button). Never saved: 1x after a load. */
  private rate: Rate = 1;
  private paused = false;
  camX = START_CAM.x;
  camY = START_CAM.y;
  /** Where the camera is easing to after a job chip was tapped (null: it stays put). */
  private camTo: { x: number; y: number } | null = null;
  /**
   * The camera the page asked for (cam=), kept while nobody has moved the camera since: the world widens as elders
   * retire (the garden grows), so a camera asked for past the start's garden end moves out to it as it grows.
   */
  private camAsked: { x: number; y: number } | null = null;
  private keeperAgents!: KeeperAgent[];
  /**
   * The building drawn at each of the night's steps (BASE_DESIGN 7: 0 the day's, 3 the night's, 1 and 2 the stepped mixes;
   * drawBuilding): the day's built with the world, each other the first frame it is needed, then kept -- rebuilt only
   * when the step changes, never a frame.
   */
  private buildings!: (HTMLCanvasElement | null)[];
  private plates!: HTMLCanvasElement;
  private readonly top = new TopPass(160);
  private readonly budget = new AmbientBudget();
  /** World steps drawn (the ambient budget's clock), and frames shown (the UI's: toasts, NEW's second tap, the autosave). */
  private frame = 0;
  private uiFrame = 0;
  /**
   * The toast showing and the frames it has left; life's news waiting to be shown, in turn; NEW's frames left to be
   * tapped again (0: not asked).
   */
  private toast: { text: string; left: number } | null = null;
  private news: News[] = [];
  private newArmed = 0;
  /** Attached with saving on: the autosave runs. */
  private saving = false;
  /** Last frame's bubbles (world px) and chips (screen px), for tapping. */
  private bubbles: { job: Job; r: Rect }[] = [];
  private chips: { job: Job; r: Rect }[] = [];
  /** The dragon whose card is open (by id; null: none), and where the card opened (hud.ts cardAt: the far side from it). */
  private card: number | null = null;
  private cardRect: Readonly<Rect> = CARD;
  /** Hatches whose shell bits are flying: the baby's id, the egg's element, its egg's spot (world px) and the world steps since. */
  private hatches: { id: number; el: Dragon['element']; x: number; y: number; age: number }[] = [];
  /** Last frame's heads of the dragons drawn (screen px, by dragon id), for the hook. */
  private heads = new Map<number, { x: number; y: number }>();
  /** The elders already told of as staying on as the barn's last flier (life.ts staysOn): each is said once. */
  private toldStay = new Set<number>();
  private detachers: (() => void)[] = [];
  /** Each keeper's px walked as of the last world step (the view's: a keeper held by hand walks only while this moves). */
  private walkedWas: number[] = [];
  /** The keeper asked for by take= (by name), taken again if a load swaps the world. */
  private readonly takeAsked: string | null;
  /** The direction held (the keys, the pad) and the last one sent to the simulation; the pad's buttons held down (by pointer). */
  private keysHeld = new Set<'up' | 'down' | 'left' | 'right'>();
  private padHeld = new Map<number, PadButton>();
  private sent = { dx: 0, dy: 0 };
  /** Frames left before the camera follows the keeper held by hand again (a drag stops it). */
  private followPause = 0;
  /** A portrait window (live: fit()): the pad's buttons are small, and a line says so while a keeper is held. */
  private portrait = false;
  /** Last frame's action line (screen px; null: none drawn), for the hook. */
  private lineRect: Rect | null = null;
  /**
   * The overlays (maptable.ts MapUi): the screen on show -- none (the barn), the Map Room table's `map` or `mission`
   * chooser (the world waits), or `watch`, the team out watched on its road (missionview.ts, the world stepping on
   * underneath: BASE_DESIGN 6) -- the mission chosen and the team being put together, the frames before the map opens, and
   * whether the trip's log is open over the watch overlay (`card`); last frame's tap targets on the table, and the TEAM
   * OUT chip's.
   */
  private ui: MapUi = newUi();
  private uiHits: Hit[] = [];
  private chipRect: Rect | null = null;
  /** The team's characters for the trip watched; whether its result card was tapped away; the last scene drawn (for the hook). */
  private watching: ScenePets | null = null;
  private resultClosed = false;
  private scene: { trip: Trip; f: SceneFrame } | null = null;
  /** The trip's state after the last world step (a landing is news). */
  private tripWas: string | null = null;
  /** A table overlay asked for by the page (panel=map | mission), opened at the first frame drawn: a frozen page steps its t first. */
  private pendingPanel: { panel: 'map' | 'mission'; mission: number } | null = null;

  constructor(opts: BaseViewOpts) {
    this.persist = !!opts.persist;
    this.layers = opts.layers === 'world' || opts.layers === 'cast' ? opts.layers : 'all';
    this.use(buildSim(opts.preset === 'trip' ? tripStart(opts.trip, opts.at ?? 0) : startSpec(opts.preset), opts.seed, opts.hour));
    if (opts.cam) { this.camAsked = { ...opts.cam }; this.setCam(opts.cam.x, opts.cam.y); }
    this.takeAsked = opts.take ?? null;
    if (this.takeAsked) this.takeByName(this.takeAsked);
    if (opts.panel === 'watch') this.openWatch();
    else if (opts.panel) this.pendingPanel = { panel: opts.panel, mission: opts.mission ?? 0 };
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
    this.keeperAgents = agents; this.buildings = [building, null, null, null]; this.plates = plates;
    this.bubbles = []; this.chips = []; this.card = null; this.hatches = []; this.heads.clear(); this.news = []; this.toldStay.clear();
    this.walkedWas = sim.keepers.map((k) => k.walked); this.sent = { dx: 0, dy: 0 };
    this.ui = newUi(); this.uiHits = []; this.chipRect = null; this.tripWas = sim.missions.trip?.state ?? null;
    this.watching = null; this.resultClosed = false; this.scene = null;
    // (a world with a smaller garden: the camera inside its end)
    this.setCam(this.camX, this.camY);
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
    // (the Map Room's table open: the world waits -- and the map opens once the camera has eased to the Map Room; under
    // the watch overlay the world steps on)
    if (this.ui.opening > 0 && --this.ui.opening === 0) this.setScreen('map');
    const steps = this.ui.screen === 'map' || this.ui.screen === 'mission' ? 0 : this.speed;
    // (a grow-up's flash counts the frames shown that step the world: as long at 8x as at 1x, and held while paused)
    if (steps > 0) for (const v of this.cast.values()) if (v.flash > 0) v.flash--;
    for (let n = steps; n > 0; n--) this.worldStep();
    // (the camera asked for, as the garden widens under it)
    if (this.camAsked && (this.camX !== this.camAsked.x || this.camY !== this.camAsked.y)) this.setCam(this.camAsked.x, this.camAsked.y);
    if (this.camTo) {
      this.setCam(this.camX + (this.camTo.x - this.camX) / 6, this.camY + (this.camTo.y - this.camY) / 6);
      if (Math.abs(this.camTo.x - this.camX) < 0.5 && Math.abs(this.camTo.y - this.camY) < 0.5) { this.setCam(this.camTo.x, this.camTo.y); this.camTo = null; }
    } else this.follow();
    if (this.followPause > 0) this.followPause--;
    this.uiFrame++;
    if (this.toast && --this.toast.left <= 0) this.toast = null;
    if (!this.toast && this.news.length) this.say(newsText(this.news.shift()!));
    if (this.newArmed > 0) this.newArmed--;
    if (this.saving && this.uiFrame % AUTOSAVE_FRAMES === 0) this.save();
  }

  /** One world step, and the view kept in step with it (a grow-up's `happy`, a hatch's shell bits, the dawn's tip). */
  private worldStep(): void {
    for (const h of this.hatches) h.age++;
    this.hatches = this.hatches.filter((h) => h.age < BITS_FRAMES);
    this.sim.step();
    this.syncCast();
    this.lifeEvents();
    for (const d of this.sim.dragons) this.sync(d, this.cast.get(d.id)!);
    const pets = this.pets;
    stepWary(pets);
    for (const p of pets) stepPet(p);
    this.sim.keepers.forEach((k, i) => { stepKeeperVisual(this.keeperAgents[i], k, k.climbing ? k.y : k.y - 3, k.walked !== this.walkedWas[i]); this.walkedWas[i] = k.walked; });
    this.frame++;
  }

  /**
   * What the step's life events look like (BASE_DESIGN 7): a dragon grown up -- already rebuilt at its new stage (syncCast) --
   * flashes flat for GROW_FLASH frames and plays `happy` once (the simulation holds it for that: its hold), and a
   * toast says so (in turn; the step's grow-ups into one stage share one); a hatch throws its egg's shell bits from the
   * nest the baby stands up in; an egg falling due with the barn full (life.ts BARN_CAP) is news too, "THE BARN IS
   * FULL" (once, however many fall due together). A team landing says how its mission went. And at 05:00 (the dawn), a
   * tip: the dragons whose stage-up falls due within TIP_DAYS days.
   */
  private lifeEvents(): void {
    const sim = this.sim;
    for (const e of sim.events) {
      // (the player's commands, answered: a team sent from the Map Room's table (or refused, and why), a keeper on a
      // mission's trip who can't be taken)
      if (e.kind === 'send') { this.say(e.reason ?? `${sim.missions.trip?.mission.title ?? 'THE TEAM'}: THE TEAM MUSTERS ON THE AERIE`); continue; }
      if (e.kind === 'refused') { this.say(e.reason); continue; }
      if (e.kind === 'full') { if (!this.news.some((n) => 'text' in n && n.text === BARN_FULL)) this.news.push({ text: BARN_FULL }); continue; }
      const d = sim.dragons.find((q) => q.id === e.dragon), v = this.cast.get(e.dragon);
      if (!d || !v) continue;
      if (e.kind === 'grow') {
        v.flash = GROW_FLASH; v.cheering = true;
        v.pet.player.play('happy', { restart: true, blend: 4 }); v.pet.anim = 'happy'; v.waking = false;
        // (news of a grow-up into this stage still waiting to be shown -- this step's, or one queued behind a toast --
        // takes this name too)
        const same = this.news.find((n): n is { stage: Stage; names: string[] } => 'stage' in n && n.stage === e.stage);
        if (same) same.names.push(d.name); else this.news.push({ stage: e.stage, names: [d.name] });
      } else if (e.kind === 'hatch') {
        // (from the nest nearest where the baby stands up)
        const room = sim.rooms.find((r) => r.kind === 'hatchery');
        if (room) {
          let nest = 0;
          for (let i = 1; i < NESTS; i++) if (Math.abs(nestX(room, i) - d.x) < Math.abs(nestX(room, nest) - d.x)) nest = i;
          this.hatches.push({ id: d.id, el: d.element, x: nestX(room, nest), y: eggBottom(room.floor), age: 0 });
        }
      } else if (e.kind === 'garden') {
        // (an elder arrived at its plot, a resident now: the garden's news, shared by those who arrive together)
        const same = this.news.find((n): n is { garden: true; names: string[] } => 'garden' in n);
        if (same) same.names.push(d.name); else this.news.push({ garden: true, names: [d.name] });
      }
    }
    // (a team landing on the Aerie: news -- how it went, and what it brings home)
    const t = sim.missions.trip, now = t?.state ?? null;
    if (t && now === 'return' && this.tripWas === 'away') {
      const c = t.success ? t.mission.coin : Math.floor(t.mission.coin / 2);
      this.news.push({ text: t.success ? `${t.mission.title}: HOME SAFE WITH ${c} COIN${t.egg ? ' AND AN EGG' : ''}` : `${t.mission.title}: BACK HOME WITH ${c} COIN. NOBODY IS HURT.` });
    }
    this.tripWas = now;
    if (sim.clock % sim.dayLen === PHASE_HOURS.dawn * hourSteps(sim.dayLen)) {
      // (the soonest of those due within TIP_DAYS, by the day they are due: today, tomorrow, or in 2 days)
      const inDays = (d: Dragon) => Math.floor(stageDue(sim, d) / sim.dayLen) - Math.floor(sim.clock / sim.dayLen);
      const soon = sim.dragons.filter((d) => d.stage !== 'elder' && stageDue(sim, d) - sim.clock <= TIP_DAYS * sim.dayLen);
      const first = Math.min(...soon.map(inDays)), who = soon.filter((d) => inDays(d) === first);
      const when = first <= 0 ? 'TODAY' : first === 1 ? 'TOMORROW' : `IN ${first} DAYS`;
      if (who.length) this.news.push({ text: who.length === 1 ? `${who[0].name} GROWS UP ${when}` : `${who.length} DRAGONS GROW UP ${when}` });
    }
    // (an elder staying on past its time for the garden, the barn's last flier: said once -- life.ts staysOn)
    for (const d of sim.dragons) {
      if (this.toldStay.has(d.id) || !staysOn(sim, d)) continue;
      this.toldStay.add(d.id);
      this.news.push({ text: `${d.name} STAYS IN THE BARN: NOBODY ELSE CAN FLY A MISSION` });
    }
  }

  /**
   * What a dragon's anim should be when it isn't walking: its job's while a keeper is at work with it, its tell while
   * it waits (standing, at a landing, at the bay's edge or riding), else idle (a paper turn too: travel.ts).
   */
  private animFor(d: Dragon): string {
    if (d.act) return d.act.need === 'sleep' && d.element === 'dusk' ? 'tuckin' : ACT_ANIM[d.act.need];
    // (a garden resident napping sleeps: garden.ts)
    if (d.garden?.mode === 'nap') return 'sleep';
    const j = this.waitingJob(d);
    // the hungry tell (4.2), and slinkwing's lonely call (3.7)
    if (j && j.need === 'food' && d.needs.food < SOON && d.move !== 'turn') return 'beg';
    if (j && j.need === 'love' && d.element === 'slinkwing' && d.needs.love < SOON && d.move !== 'turn') return 'call';
    return 'idle';
  }

  /**
   * Point a pet at its dragon (BASE_DESIGN 2): where it stands (on the car while riding) and faces; a walk bout's walk,
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
        const pre = wrapT(gaitOf(d.element, d.stage), d.gaitT - d.gaitS), whole = Math.floor(pre);
        for (let i = 0; i < whole; i++) p.player.tick();
        if (pre > whole) { p.player.speed = pre - whole; p.player.tick(); }
        p.anim = 'walk'; v.walkSeq = d.walkSeq; v.waking = false; p.hold = 0;
      }
      // (the walk plays at the speed the simulation moved the body by this step: 1, or LIVELY on and off the car and
      // across the bay -- the body moved by the same factor, so the planted paws stay planted)
      p.player.speed = d.gaitS;
    } else {
      // (a grow-up's happy plays through: the simulation holds the dragon where it stands meanwhile -- its hold, as long
      // as this happy: life.ts -- so it neither walks nor turns; an act that starts once the hold is done takes over)
      if (v.cheering && (p.player.done || p.player.name !== 'happy' || d.act)) v.cheering = false;
      const want = v.cheering ? 'happy' : this.animFor(d);
      if (v.waking && p.player.done) { v.waking = false; p.player.play('idle', { blend: 8 }); p.anim = 'idle'; }
      // (a garden resident wakes from its nap whatever it wakes to: its keeper coming, a sit)
      const woke = want === 'idle' || (d.place === 'garden' && want !== 'sleep');
      if (want !== p.anim && !(v.waking && woke)) {
        if ((p.anim === 'sleep' || p.anim === 'tuckin') && woke) { p.player.play('wake', { blend: 8 }); p.anim = 'wake'; v.waking = true; }
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

  /** The building at the night's step `step`, drawn the first time it is needed and kept. */
  private building(step: number): HTMLCanvasElement {
    return this.buildings[step] ??= drawBuilding(this.sim.rooms, step);
  }

  /**
   * The frame, back to front: the sky (screen space), the building (at the night's step: the walls and the shell by
   * moonlight, BASE_DESIGN 7), the lights, the plates, the lift's car, the cast, the top pass, the bubbles, then the HUD and
   * a toast. layers=world leaves out the sky, the lights, the HUD and the toast; layers=cast draws only the cast and the
   * bubbles on the page's flat colour: the same by day and by night (the no-tint check).
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const cx = Math.round(this.camX), cy = Math.round(this.camY), all = this.layers === 'all', world = this.layers !== 'cast';
    const read = readClock(this.sim.clock, this.sim.dayLen), lit = lightsOf(read), step = lit.walls;
    const trip = this.sim.missions.trip;
    this.scene = trip ? { trip, f: sceneAt(this.sim, trip) } : null;
    // (the team watched on its road: the overlay over the barn, the top bar kept; once the trip is over, the barn again)
    if (this.ui.screen === 'watch' && !trip) this.closeWatch();
    if (this.ui.screen === 'watch' && all && this.scene) { this.drawWatch(ctx, read, this.scene.trip, this.scene.f); this.publish(read); return; }
    const seen = (x0: number, x1: number, y0: number, y1: number) => x1 >= cx && x0 <= cx + VIEW_W && y1 >= cy && y0 <= cy + VIEW_H;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLEAR; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (all) drawSky(ctx, read, this.camX, this.camY, this.sim.worldW);
    // (the building's canvas ends at WORLD_W: the garden lies past it)
    const bw = Math.min(VIEW_W, WORLD_W - cx), span = [cx, cx + VIEW_W] as const;
    if (world && bw > 0) ctx.drawImage(this.building(step), cx, cy, bw, VIEW_H, 0, 0, bw, VIEW_H);
    ctx.save();
    ctx.translate(-cx, -cy);
    // the garden past the right tower (its plots on screen), then the lights -- the lanterns' rings with them
    if (world) drawGarden(ctx, this.sim.garden.plots, this.sim.worldW, span, step);
    if (all) { drawLights(ctx, this.sim.rooms, read); drawGardenLights(ctx, this.sim.garden.plots, lit, span); }
    ctx.restore();
    // the names are on the walls: under the lift's car and the cast, so a name never covers a face (a keeper passing
    // under the Lamp Dorm's plate hides part of it for a moment instead)
    if (world && bw > 0) ctx.drawImage(this.plates, cx, cy, bw, VIEW_H, 0, 0, bw, VIEW_H);
    ctx.save();
    ctx.translate(-cx, -cy);
    if (world) { drawGardenPlate(ctx, span); drawLiftCar(ctx, this.sim.lift.y, step); }
    // the eggs in their nests (on the building, under the cast), and a hatch's shell bits bursting from behind the baby
    // standing up in the nest (under the cast too: never over a dragon, or an eye)
    const hatchery = this.sim.rooms.find((r) => r.kind === 'hatchery');
    if (hatchery && world) for (const e of this.sim.eggs) {
      const x = nestX(hatchery, e.nest), y = eggBottom(hatchery.floor);
      if (!seen(x - 8, x + 8, y - 26, y + 2)) continue;
      drawEgg(ctx, e.element, x, y, this.progress(e), this.sim.tick);
      // (a due egg still in its nest is waiting for room -- the barn at its cap, or no baby sub-slot free: life.ts --
      // and says so with three ink dots over it, in the eggs' layer: under the cast, so never over an eye)
      if (this.sim.clock - e.laid >= HATCH_DAYS * this.sim.dayLen) drawWaiting(ctx, x, y);
    }
    if (world) for (const h of this.hatches) drawShellBits(ctx, h.el, h.x, h.y, h.age);
    // the cast, y-sorted by the feet; keepers stand a step behind the dragons they work with, so a dragon's head is
    // never covered (ART_BIBLE 1.4: nothing covers the eye) -- and one on a ladder, behind the dragons of both floors it
    // climbs between (sorted a step behind the upper floor's), so a head at a landing beside the ladder stays clear
    const cast: { y: number; pet?: Pet; view?: PetView; id?: number; keeper?: number }[] = [];
    // (a mission's team away is off the map: its dragons and riders are not drawn)
    const away = new Set(this.sim.dragons.filter((d) => d.place === 'away').map((d) => d.id));
    for (const [id, v] of this.cast) { const p = v.pet, [a, b] = extentX(p); if (!away.has(id) && seen(a - 24, b + 24, p.y - 110, p.y + 12)) cast.push({ y: p.y, pet: p, view: v, id }); }
    this.sim.keepers.forEach((k, i) => {
      if (k.phase === 'away') return;
      const y = k.climbing ? k.y : k.y - 3;
      if (seen(k.x - 30, k.x + 30, y - 100, y + 8)) cast.push({ y: castKey(k), keeper: i });
    });
    cast.sort((a, b) => a.y - b.y);
    this.budget.begin(cast.filter((c) => c.pet).length, this.frame);
    let slot = 0;
    this.heads.clear();
    const head = { x: 0, y: 0 };
    for (const c of cast) {
      if (c.pet) {
        const p = c.pet;
        // (a dragon that has just grown up is drawn flat in its glow's highlight inside its own ink: the grow-up's flash,
        // ART_BIBLE 4.2 -- the one flash the base draws)
        drawDragon(ctx, p.rig, p.player.pose, petOpts(p, { still: true, top: this.top, budget: this.budget, slot: slot++, flat: !!c.view && c.view.flash > 0 }));
        if (p.bowl) drawBowl(ctx, p);
        rootToScreen(p.rig, p.rig.j.cran.x, p.rig.j.cran.y, head);
        this.heads.set(c.id!, { x: head.x - cx, y: head.y - cy });
      } else if (c.keeper != null) drawKeeperVisual(ctx, this.keeperAgents[c.keeper], this.sim.keepers[c.keeper], this.sim.missions.trip?.egg ?? null);
    }
    this.top.flush(ctx);
    // the bubbles: each awake dragon's most pressing job that no one is at work on yet (a hatchling's once its shell's
    // bits have landed: they fly where its bubble stands)
    this.bubbles = [];
    const pt = { x: 0, y: 0 };
    for (const d of this.sim.dragons) {
      if ((d.act && d.act.need === 'sleep') || d.place === 'away' || this.hatches.some((h) => h.id === d.id)) continue;
      const j = this.waitingJob(d), v = this.cast.get(d.id);
      if (!j || !v) continue;
      const p = v.pet, J = p.rig.j;
      rootToScreen(p.rig, J.cran.x, J.top, pt);
      if (!seen(pt.x - 24, pt.x + 24, pt.y - 34, pt.y)) continue;
      this.bubbles.push({ job: j, r: drawBubble(ctx, pt.x, pt.y - 2, j.need, tierOf(d.needs[j.need]), !!j.keeper) });
    }
    ctx.restore();
    this.chips = [];
    this.uiHits = []; this.chipRect = null;
    if (all) {
      this.hud(ctx, read);
      // (a panel= page's overlay opens at its first frame, once its t steps are done)
      if (this.pendingPanel) this.openPanel();
      // the Map Room table's overlays, over the world and under the top bar's line
      if (this.ui.screen === 'map') this.uiHits = drawMapScreen(ctx, this.sim);
      else if (this.ui.screen === 'mission') this.uiHits = drawMissionScreen(ctx, this.sim, this.ui);
      // (the toast low in an open table overlay's panel, so it never runs over its words; and one too long to clear the
      // TEAM OUT chip, under it)
      if (this.toast) {
        const t = this.toast.text, chip = this.chipRect as Rect | null, overChip = !!chip && VIEW_W / 2 + measureText(t) / 2 + 2 >= chip.x;
        drawToast(ctx, t, this.ui.screen !== 'none' ? PANEL.y + PANEL.h - 14 : overChip ? chip!.y + chip!.h + 3 : 20);
      }
    }
    this.publish(read);
  }

  /**
   * The team out, watched (BASE_DESIGN 6): the scene over the barn (missionview.ts: the road, its stops, the baddie, the team,
   * the banner), the result card once the trip's time is up (until tapped away), the way back to the barn, and the top
   * bar over it all -- the world steps on underneath (the barn's own frame is not drawn meanwhile).
   */
  private drawWatch(ctx: CanvasRenderingContext2D, read: ClockRead, trip: Trip, f: SceneFrame): void {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLEAR; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!this.watching || this.watching.trip !== trip) this.watching = new ScenePets(this.sim, trip);
    drawMissionScene(ctx, this.sim, trip, this.watching, f);
    // (the result card once the trip's time is up; then the trip's log over it, opened by TRIP LOG -- the stops met,
    // unmet and ahead, the log's latest lines, the time left -- so the log asked for is read whole)
    if (f.done && !this.resultClosed) drawResultCard(ctx, trip, this.sim.tick);
    if (this.ui.card) drawTripCard(ctx, this.sim, trip);
    drawBackButton(ctx);
    this.uiHits = [{ r: LOG_BUTTON, act: { kind: 'none' }, name: 'log' }];
    drawLogButton(ctx, this.ui.card);
    // (the top bar as over the barn: the keepers' badges live -- a tap takes that keeper, back in the barn -- the one held
    // lit; the pad and the line are the barn's, not drawn over the scene)
    this.topBar(ctx, read, this.held());
    // (the toast shows over the scene too -- life's news, a landing, the dawn's tip keep coming while the team is
    // watched -- low on the verge under the road, clear of the banner, the log, the result card and the buttons)
    if (this.toast) drawToast(ctx, this.toast.text, WATCH_TOAST_Y);
    this.bubbles = []; this.chips = []; this.heads.clear(); this.lineRect = null; this.chipRect = null;
  }

  /**
   * Open the watch overlay on the trip that is out (none out: nothing happens). A keeper held by hand stays held but
   * stands still while it is open (steer: no direction reaches them, E does nothing), walking on as the keys still down
   * say once it closes.
   */
  private openWatch(): void {
    const trip = this.sim.missions.trip;
    if (!trip) return;
    this.card = null;
    if (!this.watching || this.watching.trip !== trip) { this.watching = null; this.resultClosed = false; this.ui.card = false; }
    this.setScreen('watch');
  }

  /** Close the watch overlay (BACK TO BARN, Esc, a badge, Tab, the trip over): the barn again, the keeper held steered as the keys and pad say. */
  private closeWatch(): void { this.setScreen('none'); }

  /** An overlay on (or none), and the keeper held steered as that allows (under an overlay they stand still). */
  private setScreen(s: Screen): void {
    this.ui.screen = s;
    this.steer();
  }

  /** Close whichever overlay is open (Esc, a badge, Tab), or stop the map opening. */
  private closeOverlay(): void {
    if (this.ui.screen === 'watch') this.closeWatch();
    else this.closeTable();
  }

  /** A tap on the watch overlay (under the top bar): BACK TO BARN, TRIP LOG, the log tapped shut (it is drawn on top), the result card tapped away; anything else swallowed. */
  private watchTap(sx: number, sy: number): void {
    if (hit(BACK_BUTTON, sx, sy)) this.closeWatch();
    else if (hit(LOG_BUTTON, sx, sy)) this.ui.card = !this.ui.card;
    else if (this.ui.card && hit(TRIP_CARD, sx, sy)) this.ui.card = false;
    else if (this.scene?.f.done && !this.resultClosed && hit(RESULT_CARD, sx, sy)) this.resultClosed = true;
  }

  /** The hook (window.__dragonCare.base): the world as of this frame, and the overlay and the scene (BASE_DESIGN 6). */
  private publish(read: ClockRead): void {
    if (typeof window !== 'undefined' && window.__dragonCare) {
      const st = this.sim.stats, cx = Math.round(this.camX), cy = Math.round(this.camY), all = this.layers === 'all' && this.ui.screen === 'none', chip = this.chipRect as Rect | null;
      window.__dragonCare.base = { tick: this.sim.tick, camX: this.camX, camY: this.camY, jobs: this.sim.jobs.length, done: st.done, rushes: st.rushes, preempted: st.preempted,
        chips: this.chips.map((c) => ({ ...c.r, dragon: c.job.dragon.name, need: c.job.need, rushed: c.job.rushed })),
        digest: fnv1a(worldKey(this.sim)),
        barnDigest: fnv1a(barnKey(this.sim)),
        clock: { day: read.day, hour: read.hour, minute: read.minute, phase: read.phase },
        night: lightsOf(read).walls,
        speed: this.speed,
        persist: this.persist,
        buttons: { ...BUTTONS },
        dragons: this.sim.dragons.map((d) => ({ id: d.id, name: d.name, element: d.element, stage: d.stage, place: d.place, f: d.f, x: d.x, move: d.move,
          room: this.sim.rooms.find((r) => r.floor === d.f && d.x >= r.x0 && d.x <= r.x1)?.kind ?? null,
          slot: d.slot ? `${this.sim.rooms[d.slot.room].kind}:${d.slot.i}` : null,
          waiting: !!this.waitingJob(d), head: this.heads.get(d.id) ?? null })),
        lift: { y: this.sim.lift.y, rider: this.sim.lift.rider },
        walked: st.dragonWalked,
        eggs: this.sim.eggs.map((e) => ({ element: e.element, nest: e.nest, progress: this.progress(e) })),
        card: this.cardDragon()?.name ?? null,
        cardBox: this.cardDragon() ? { ...this.cardRect } : null,
        garden: { residents: this.sim.dragons.filter((d) => d.place === 'garden').length, plots: this.sim.garden.plots, worldW: this.sim.worldW },
        keepers: this.sim.keepers.map((k) => { const b = this.keeperBox(k); return { name: k.name, f: k.f, x: k.x, phase: k.phase, carrying: k.carrying, box: { x: b.x - cx, y: b.y - cy, w: b.w, h: b.h } }; }),
        controlled: controlledKeeper(this.sim)?.name ?? null,
        badges: Object.fromEntries(this.sim.keepers.map((k, i) => [k.name, { x: BADGE_X0 + i * BADGE_DX, y: BADGE_Y, w: BADGE_W, h: BADGE_H }])),
        pad: { ...PAD },
        // (the line is the barn's: none over an overlay)
        action: (() => { const k = this.held(); return k && all ? this.actionLine(k) : null; })(),
        line: this.lineRect ? { ...this.lineRect } : null,
        doneBy: { ...st.doneBy },
        coin: this.sim.missions.coin,
        board: this.sim.missions.board.map((m) => ({ id: m.id, region: m.region, title: m.title, difficulty: m.difficulty, challenges: [...m.challenges], baddie: m.baddie, days: m.days, coin: m.coin })),
        trip: this.tripHook(),
        ui: { screen: this.ui.screen, mission: this.ui.mission, pairs: this.ui.pairs.map((p) => ({ ...p })),
          pins: this.uiHits.filter((h) => h.name?.startsWith('pin')).map((h) => ({ ...h.r })),
          buttons: Object.fromEntries([...this.uiHits.filter((h) => h.name && !h.name.startsWith('pin')).map((h) => [h.name!, { ...h.r }] as const), ...(chip ? [['chip', { ...chip }] as const] : [])]),
          chip: chip ? { ...chip } : null, back: this.ui.screen === 'watch' ? { ...BACK_BUTTON } : null, log: this.ui.screen === 'watch' && this.ui.card,
          // (the chooser's line about the egg, as drawMissionScreen draws it: only while a mission's chooser is open)
          notice: this.ui.screen === 'mission' && chosen(this.sim, this.ui) ? eggNotice(this.sim) : null },
        scene: this.sceneHook(),
        barn: { count: barnCount(this.sim), cap: BARN_CAP },
        toast: this.toast?.text ?? null };
    }
  }

  /** The trip out, for the hook: its state, mission, region, outcome, pairs (by id), times and progress; or null. */
  private tripHook() {
    const t = this.sim.missions.trip;
    if (!t) return null;
    return { state: t.state, mission: t.mission.title, region: t.mission.region, success: t.success, egg: t.egg, pairs: t.pairs.map((p) => ({ ...p })),
      departAt: t.departAt, returnAt: t.returnAt, progress: tripProgress(this.sim, t) };
  }

  /** The scene as the hook reports it (BASE_DESIGN 6): the last stop reached, its banner, the boss on the road and its health, the foes in view and what is in flight, how far along it is, and the result card's title once it is done. */
  private sceneHook(): NonNullable<NonNullable<Window['__dragonCare']>['base']>['scene'] {
    if (!this.scene) return null;
    const { trip, f } = this.scene, s = f.last == null ? null : trip.stops[f.last];
    return { stop: s ? (s.kind === 'challenge' ? s.challenge : s.kind) : null, covered: s ? s.covered : null, beat: f.stop != null, banner: f.banner,
      baddie: f.baddie?.id ?? null, face: f.baddie?.face ?? null, pose: f.baddie?.pose ?? null, bar: f.bar, foes: f.foes.length, shots: f.shots.length,
      progress: f.L ? f.E / f.L : 0, done: f.done, result: f.done ? resultTitle(trip) : null };
  }

  /** How far on an egg is: 0 laid, 1 due (its HATCH_DAYS in the nest; one past it waits for a sub-slot at 1). */
  private progress(e: { laid: number }): number { return Math.max(0, Math.min(1, (this.sim.clock - e.laid) / (HATCH_DAYS * this.sim.dayLen))); }

  /**
   * The hint at the bottom right, one of these in turn (HINT_FRAMES each, by the view's UI frame, so a frozen t= shows the
   * same one): the two taps; the Map Room -- THE LOST NEST by name while it waits on the first board, and none while a
   * team is out; looking around the barn; and the keys for a keeper taken.
   */
  private hintText(): string {
    const ms = this.sim.missions, map = ms.trip ? null : ms.sent === 0 && ms.board.some((m) => m.title === LOST_NEST) ? `TAP MAP: SEND A TEAM TO ${LOST_NEST}` : 'TAP MAP: SEND A TEAM ON A MISSION';
    const hints = [HINT_TAPS, map, 'DRAG TO LOOK AROUND THE BARN', 'TAKE A KEEPER: WASD TO WALK, E TO ACT'].filter((h): h is string => !!h);
    return hints[Math.floor(this.uiFrame / HINT_FRAMES) % hints.length];
  }

  /** The dragon whose card is open, if it is still in the world (null: none). */
  private cardDragon(): Dragon | null { return this.card == null ? null : this.sim.dragons.find((d) => d.id === this.card) ?? null; }

  /**
   * The HUD (4.8): the top bar (the time, the jobs, the keepers' badges, NEW, pause and the speed: hud.ts), the job
   * strip along the bottom, the two gestures at the bottom right, and a dragon's card if one is open.
   */
  private hud(ctx: CanvasRenderingContext2D, read: ClockRead): void {
    const text = (s: string, x: number, y: number, color: string) => drawText(ctx, s, x, y, { color, shadow: false });
    const held = this.held();
    this.topBar(ctx, read, held);
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
    // (the hint gives way to the pad while a keeper is held)
    if (!held) drawHint(ctx, x, this.hintText());
    // (a team out -- the Map Room's, or a preview -- its TEAM OUT chip under the top bar, which opens the scene)
    this.chipRect = this.scene && this.ui.screen === 'none' ? drawTeamChip(ctx, this.sim, this.scene.trip, false) : null;
    const d = this.cardDragon();
    if (d) {
      // (a garden resident has only food and love: GARDEN_NEEDS)
      const garden = d.place === 'garden';
      const needs = Object.fromEntries(NEEDS.map((k) => [k, hasNeed(d.element, k) && (!garden || GARDEN_NEEDS.includes(k)) ? d.needs[k] : null])) as Record<NeedKind, number | null>;
      drawCard(ctx, { name: d.name, element: d.element, stage: d.stage, day: Math.floor((this.sim.clock - d.stageSince) / this.sim.dayLen) + 1, needs, garden, stays: staysOn(this.sim, d) }, this.cardRect);
    }
    this.lineRect = null;
    // (the pad and its line are the barn's: not under the Map Room's table either)
    if (held && this.ui.screen === 'none') {
      this.lineRect = drawActionLine(ctx, this.actionLine(held), this.actionText(held), x);
      drawPad(ctx, new Set(this.padHeld.values()));
      if (this.portrait) drawPortraitHint(ctx);
    }
  }

  /**
   * The keeper held by hand as the player last asked: the simulation's (control.ts controlledKeeper), with the takes
   * and releases still waiting for the next world step applied -- so a badge, Tab, the pad and the camera answer at
   * once, paused too (a paused world steps none).
   */
  private held(): Keeper | null {
    let id = this.sim.controlled;
    for (const c of this.sim.commands) if (c.kind === 'take') id = c.keeper; else if (c.kind === 'release') id = null;
    return id == null ? null : this.sim.keepers.find((k) => k.id === id) ?? null;
  }

  /** What a keeper's badge shows: held by hand (or about to be), at a job, or free. */
  private badgeState(k: Keeper, held: Keeper | null): BadgeState { return k === held ? 'held' : k.job ? 'busy' : 'free'; }

  /**
   * The top bar (over the barn and over the watch overlay alike): the clock, the jobs, the keepers' badges (held by
   * hand, at a job, away on a mission or resting after one), the coin, the barn's dragons against its cap (amber when
   * full), and the buttons -- MAP lit while the table is open or opening.
   */
  private topBar(ctx: CanvasRenderingContext2D, read: ClockRead, held: Keeper | null): void {
    drawTopBar(ctx, { clock: read, jobs: this.sim.jobs.length,
      keepers: this.sim.keepers.map((k) => ({ name: k.name, look: k.look, state: this.badgeState(k, held), trip: onTrip(k) ? 'away' : k.phase === 'rest' ? 'rest' : null })),
      speed: this.speed, rate: this.rate, armed: this.newArmed > 0, coin: this.sim.missions.coin,
      map: this.ui.screen === 'map' || this.ui.screen === 'mission' || this.ui.opening > 0,
      barn: { count: barnCount(this.sim), cap: BARN_CAP, full: barnFull(this.sim) } });
  }

  /** What E does now for the keeper held ("E: FEED WICK"), what they are at, or '' (taken while paused: not theirs yet). */
  private actionText(k: Keeper): string { return k.manual ? actionFor(this.sim, k).label : k.pendingTake ? 'FINISHING A JOB' : ''; }

  /** The line under the pad: the keeper held, what they carry, and what E does now ("BEA - BOWL - E: FEED WICK"). */
  private actionLine(k: Keeper): string {
    return [k.name, k.carrying ? SUPPLY_NAME[k.carrying] : null, this.actionText(k) || null].filter(Boolean).join(' - ');
  }

  /**
   * The dragon under a world point (its body's box: its width, from the top of its head to its feet), the last by id
   * first; whether the point is on its head (a box a head's radius and 3 px round its cranium); and where it sorts in
   * the cast (its feet). Null: none (a dragon away on a mission is not drawn).
   */
  private dragonAt(wx: number, wy: number): { d: Dragon; head: boolean; feet: number } | null {
    const top = { x: 0, y: 0 }, cran = { x: 0, y: 0 };
    for (let i = this.sim.dragons.length - 1; i >= 0; i--) {
      const d = this.sim.dragons[i], v = this.cast.get(d.id);
      if (!v || d.place === 'away') continue;
      const p = v.pet, [a, b] = extentX(p);
      rootToScreen(p.rig, p.rig.j.cran.x, p.rig.j.top, top);
      if (wx < a || wx > b || wy < top.y || wy > p.y + 4) continue;
      rootToScreen(p.rig, p.rig.j.cran.x, p.rig.j.cran.y, cran);
      const r = Math.max(4, cran.y - top.y) + 3;
      return { d, head: Math.abs(wx - cran.x) <= r && wy <= cran.y + r, feet: p.y };
    }
    return null;
  }

  /** A keeper's tap box (world px): KEEPER_BOX around their feet as drawn. */
  private keeperBox(k: Keeper): Rect {
    const y = k.climbing ? k.y : k.y - 3, top = k.look === 'pip' ? KEEPER_BOX.topSmall : KEEPER_BOX.top;
    return { x: k.x - KEEPER_BOX.half, y: y - top, w: KEEPER_BOX.half * 2, h: top + KEEPER_BOX.below };
  }

  /** Show a toast now (it replaces the one showing; life's news waits its turn behind it). */
  private say(text: string): void { this.toast = { text, left: TOAST_FRAMES }; }

  /** Pick a speed (1, 2, 4 or 8 steps a frame), playing; pause and play. */
  private setRate(r: Rate): void { this.rate = r; this.paused = false; }
  private togglePause(): void { this.paused = !this.paused; }

  /** A top-bar button: NEW (asked twice), pause, the speed (the next of 1x, 2x, 4x, 8x), MAP (the Map Room's table, or closing it). */
  private press(b: ButtonName): void {
    if (b === 'map') this.toggleMap();
    else if (b === 'pause') this.togglePause();
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

  // ---------- the Map Room's table (BASE_DESIGN 5) ----------

  /** MAP or M: the camera eases to the Map Room and the map opens (MAP_OPEN_FRAMES on); again, and the table closes. */
  private toggleMap(): void {
    if (this.ui.screen === 'map' || this.ui.screen === 'mission' || this.ui.opening > 0) { this.closeTable(); return; }
    // (from over the watch overlay: back to the barn, then to the Map Room)
    if (this.ui.screen === 'watch') this.closeWatch();
    this.card = null;
    this.camAsked = null; this.camTo = { ...MAP_CAM };
    this.ui.opening = MAP_OPEN_FRAMES;
  }
  private closeTable(): void { this.ui.opening = 0; this.ui.mission = null; this.ui.pairs = []; this.setScreen('none'); }
  /** A panel= page: its overlay, open now (a mission's by its place on the board). */
  private openPanel(): void {
    const p = this.pendingPanel!;
    this.pendingPanel = null;
    const m = this.sim.missions.board[p.mission];
    if (p.panel === 'mission' && m) { this.ui.mission = m.id; this.ui.pairs = []; this.setScreen('mission'); } else this.setScreen('map');
  }
  /**
   * A tap on the table's overlay: a pin opens its mission; BACK goes back a screen; BEST TEAM, the team edits; SEND sends
   * -- as a command (control.ts: the simulation sends the team at its next step, or refuses it, and a `send` event says
   * which: lifeEvents' toast), the table closed and the camera easing to the Aerie. A team that can't go now is not
   * sent: the reason is the toast (and SEND's own greyed words).
   */
  private tableTap(sx: number, sy: number): void {
    const act = hitAt(this.uiHits, sx, sy);
    if (act.kind === 'back') { if (this.ui.screen === 'mission') { this.ui.mission = null; this.ui.pairs = []; this.setScreen('map'); } else this.closeTable(); }
    else if (act.kind === 'pin') { this.ui.mission = act.mission; this.ui.pairs = []; this.setScreen('mission'); }
    else if (act.kind === 'send') {
      const m = chosen(this.sim, this.ui), why = m ? canSend(this.sim, m, this.ui.pairs) : 'PICK A MISSION';
      if (why || !m) { this.say(why ?? 'PICK A MISSION'); return; }
      this.send({ kind: 'send', mission: m.id, pairs: this.ui.pairs.map((p) => ({ ...p })) });
      this.closeTable();
      // (paused, the command waits for the next world step)
      if (this.speed === 0) this.say(`${m.title}: THE TEAM GOES WHEN THE GAME PLAYS`);
      this.camAsked = null; this.camTo = { ...AERIE_CAM };
    } else if (act.kind !== 'none') { const said = editTeam(this.sim, this.ui, act); if (said) this.say(said); }
  }

  /** Keep the barn (a page that saves: storage.ts). */
  private save(): void { if (this.persist) writeSave(serialize(this.sim)); }

  // ---------- input ----------

  /** The camera, kept inside the world: out to the garden's end (sim.worldW, which grows as elders retire). */
  private setCam(x: number, y: number): void {
    this.camX = clamp(x, 0, this.sim.worldW - VIEW_W);
    this.camY = clamp(y, 0, WORLD_H - VIEW_H);
  }

  /**
   * A tap, in this order (BASE_DESIGN 4.10): a top-bar button, or a keeper's badge (taking that keeper -- or letting go of the
   * one held -- and easing the camera to them; the rest of the bar takes the tap too: it covers the world there); the
   * pad while a keeper is held (ACT, LET GO); an open dragon card closes (it covers the world there too); a job chip
   * rushes its job and brings its dragon into view; a bubble rushes its job; a keeper is taken; a tap on a dragon opens
   * its card -- and rushes its job, if one is waiting (BASE_DESIGN 7); a tap on empty space lets go of the keeper held. Any
   * tap but a button's closes the card (the buttons leave it open: the game can be paused to read it). A team out
   * (BASE_DESIGN 6): the TEAM OUT chip, after the pad, opens the watch overlay; while it is open the buttons still work, a
   * badge goes back to the barn and takes (or lets go of) that keeper, and every tap under the bar is the overlay's --
   * BACK TO BARN, the result card tapped away, anything else swallowed -- before the pad or the world could take it.
   */
  tap(sx: number, sy: number): void {
    if (this.layers === 'all') {
      const b = buttonAt(sx, sy);
      if (b) { this.press(b); return; }
      const i = badgeAt(sx, sy, this.sim.keepers.length);
      if (i != null) {
        const k = this.sim.keepers[i];
        // (over an overlay too: back to the barn, where that keeper is)
        if (this.ui.screen !== 'none' || this.ui.opening > 0) this.closeOverlay();
        if (this.held() === k) this.send({ kind: 'release' });
        else { this.take(k.id); this.focusKeeper(k); }
        return;
      }
      if (sy < BAR_H) return;
      // (an overlay open takes every tap under the bar, before the barn's pad and world: the watch overlay's BACK TO
      // BARN, its TRIP LOG, the result card tapped away, the log closed; the Map Room table's own; anything else is
      // swallowed -- and while the map is opening, nothing)
      if (this.ui.screen === 'watch') { this.watchTap(sx, sy); return; }
      if (this.ui.screen !== 'none') { this.tableTap(sx, sy); return; }
      if (this.ui.opening > 0) return;
      if (this.held()) {
        const pb = padAt(sx, sy);
        if (pb === 'act') { this.send({ kind: 'act' }); return; }
        if (pb === 'letgo') { this.send({ kind: 'release' }); return; }
        if (pb) return;
      }
      // (a team out: the TEAM OUT chip under the top bar opens the scene)
      if (this.chipRect && hit(this.chipRect, sx, sy)) { this.openWatch(); return; }
      if (this.cardDragon() && hit(this.cardRect, sx, sy)) { this.card = null; return; }
    }
    this.card = null;
    for (const c of this.chips) if (hit(c.r, sx, sy)) { this.sim.rush(c.job); this.focus(c.job.dragon); return; }
    const wx = sx + Math.round(this.camX), wy = sy + Math.round(this.camY);
    // (the top-most bubble first: later ones are drawn over earlier ones)
    for (let i = this.bubbles.length - 1; i >= 0; i--) { const b = this.bubbles[i]; if (hit(b.r, wx, wy)) { this.sim.rush(b.job); return; } }
    // (a keeper: their body's box, the one drawn in front first -- unless the tap is on the head of a dragon drawn over
    // them: the cast is drawn y-sorted with keepers a step behind the dragons beside them, so a head seen in front of a
    // keeper is the dragon's to answer)
    const ks = this.sim.keepers.filter((k) => hit(this.keeperBox(k), wx, wy)).sort((a, b) => castKey(b) - castKey(a));
    const on = this.dragonAt(wx, wy);
    if (ks.length && !(on && on.head && on.feet > castKey(ks[0]))) { if (this.held() !== ks[0]) this.take(ks[0].id); return; }
    if (on) {
      const j = this.waitingJob(on.d);
      if (j) this.sim.rush(j);
      this.card = on.d.id; this.cardRect = cardAt(sx, this.heads.values());
      return;
    }
    // (the Map Room's table: a tap on it opens the map at once)
    if (this.layers === 'all' && hit(TABLE, wx, wy)) { this.camAsked = null; this.camTo = { ...MAP_CAM }; this.card = null; this.setScreen('map'); return; }
    // (empty space: the keeper held is let go)
    if (this.held()) this.send({ kind: 'release' });
  }

  /** Give the simulation a command (control.ts): it acts at the start of the next world step. */
  private send(c: Command): void { this.sim.command(c); }

  /**
   * Take a keeper (by id), and hand on the direction already held (a take clears it: the keys still down walk the new
   * one) -- or, a keeper on a mission's trip, say why not (the simulation refuses them too: control.ts take).
   */
  private take(id: number): void {
    const k = this.sim.keepers.find((q) => q.id === id);
    if (k && onTrip(k)) { this.say(takeRefusal(k)); return; }
    this.send({ kind: 'take', keeper: id });
    this.sent = { dx: 0, dy: 0 };
    this.steer();
  }

  /** Take a keeper by name (take=, any case), if there is one. */
  private takeByName(name: string): void {
    const k = this.sim.keepers.find((q) => q.name.toLowerCase() === name.toLowerCase());
    if (k) this.take(k.id);
  }

  /** The direction held now -- the keys and the pad's buttons held down -- sent to the simulation when it changes. */
  private steer(): void {
    // (under an overlay the keeper held stands still: the barn, where they walk, is not on screen)
    const on = (d: 'up' | 'down' | 'left' | 'right') => this.ui.screen === 'none' && (this.keysHeld.has(d) || [...this.padHeld.values()].includes(d));
    const dx = (+on('right') - +on('left')) as -1 | 0 | 1, dy = (+on('down') - +on('up')) as -1 | 0 | 1;
    if (dx === this.sent.dx && dy === this.sent.dy) return;
    this.sent = { dx, dy };
    this.send({ kind: 'steer', dx, dy });
  }

  /**
   * The camera follows the keeper held by hand (not while a drag has it, FOLLOW_PAUSE frames): it eases an eighth of
   * the way a frame to keep their feet between FOLLOW's x on screen, and at FRAME_FEET's y (their floor framed).
   */
  private follow(): void {
    const k = this.held();
    if (!k || this.followPause > 0) return;
    const feet = k.climbing ? k.y : k.y - 3, fx = k.x - this.camX;
    const tx = clamp(fx < FOLLOW.x0 ? k.x - FOLLOW.x0 : fx > FOLLOW.x1 ? k.x - FOLLOW.x1 : this.camX, 0, this.sim.worldW - VIEW_W);
    const ty = clamp(feet - FRAME_FEET, 0, WORLD_H - VIEW_H);
    if (tx === this.camX && ty === this.camY) return;
    this.camAsked = null;
    const was = { x: this.camX, y: this.camY };
    this.setCam(this.camX + (tx - this.camX) / FOLLOW_EASE, this.camY + (ty - this.camY) / FOLLOW_EASE);
    // (the last half px at once: the ease never quite arrives)
    if (Math.abs(this.camX - was.x) < 0.125 && Math.abs(this.camY - was.y) < 0.125) this.setCam(tx, ty);
  }

  /** Ease the camera to a keeper (a badge tapped). */
  private focusKeeper(k: Keeper): void {
    this.camAsked = null; this.followPause = 0;
    this.camTo = { x: clamp(k.x - VIEW_W / 2, 0, this.sim.worldW - VIEW_W), y: clamp(k.y - VIEW_H * 0.6, 0, WORLD_H - VIEW_H) };
  }

  /** Ease the camera to a dragon. */
  private focus(d: Dragon): void {
    this.camAsked = null;
    this.camTo = { x: clamp(d.x - VIEW_W / 2, 0, this.sim.worldW - VIEW_W), y: clamp(this.feet(d) - VIEW_H * 0.6, 0, WORLD_H - VIEW_H) };
  }

  /**
   * Live only: size the canvas to the window (whole pixels, or under 1x in a small window); take the pointers -- drag
   * to pan, tap to Rush, take a keeper or press a button, hold the pad -- and the keys (1-4 the speed, p pause, WASD or
   * the arrows, E or Space, Esc, Tab: BASE_DESIGN 4.10). A page that may save loads the player's barn now (one that didn't
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
    // (take= asks for a keeper: taken again in a world a load swapped in)
    if (this.takeAsked && !this.sim.commands.some((c) => c.kind === 'take')) this.takeByName(this.takeAsked);
    // the keys: 1-4 the speed, p pause, m the Map Room's table (BASE_DESIGN 5); WASD or the arrows walk the keeper held, E or
    // Space acts (not on a key's repeats), Esc lets go, Tab takes the next keeper (passing over those on a mission's
    // trip). Over an overlay (the watch overlay, BASE_DESIGN 6, and the Map Room's table alike) the speed keys work as ever,
    // the keeper held stands still (steer) and E does nothing, Esc goes back to the barn (the keeper still held), and
    // Tab goes back to the barn and takes the next keeper, as a badge does
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key), dir = DIR_KEYS[e.key], overlay = this.ui.screen !== 'none';
      if (i >= 0) this.setRate(RATES[i]);
      else if (e.key === 'p' || e.key === 'P') this.togglePause();
      else if (e.key === 'm' || e.key === 'M') this.toggleMap();
      else if (dir) { this.keysHeld.add(dir); this.steer(); }
      else if (e.key === 'e' || e.key === 'E' || e.key === ' ') { if (!e.repeat && !overlay) this.send({ kind: 'act' }); }
      else if (e.key === 'Escape') { if (overlay || this.ui.opening > 0) this.closeOverlay(); else this.send({ kind: 'release' }); }
      else if (e.key === 'Tab') {
        if (overlay || this.ui.opening > 0) this.closeOverlay();
        const ks = this.sim.keepers, h = this.held(), at = h ? ks.indexOf(h) : -1;
        const next = ks.map((_, n) => ks[(at + 1 + n) % ks.length]).find((k) => !onTrip(k)) ?? ks[(at + 1) % ks.length];
        this.take(next.id);
      } else return;
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { const dir = DIR_KEYS[e.key]; if (dir) { this.keysHeld.delete(dir); this.steer(); } };
    // (a window that loses the keys or is hidden holds nothing)
    const letGo = () => { this.keysHeld.clear(); this.padHeld.clear(); this.steer(); };
    const onVis = () => { if (document.visibilityState === 'hidden') letGo(); };
    addEventListener('keydown', onKey);
    addEventListener('keyup', onKeyUp);
    addEventListener('blur', letGo);
    document.addEventListener('visibilitychange', onVis);
    this.detachers.push(() => {
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('blur', letGo);
      document.removeEventListener('visibilitychange', onVis);
    });
    // the canvas as big as the window lets it be: whole pixels from 1x up, and smaller than 1x in a window that small
    // (a phone held upright: the pad's buttons are small then, and a line says to turn it sideways)
    const fit = () => {
      const r = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H), s = r >= 1 ? Math.floor(r) : r;
      canvas.style.width = `${VIEW_W * s}px`; canvas.style.height = `${VIEW_H * s}px`;
      this.portrait = innerHeight > innerWidth;
    };
    fit();
    // the pointers, each tracked on its own (BASE_DESIGN 4.10): a pad direction held down walks until it is let up; ACT and
    // LET GO fire on an up that didn't drag; the first pointer not on the pad drags the camera; an up that didn't drag
    // is a tap
    const down = new Map<number, { x: number; y: number; camX: number; camY: number; drag: boolean; pad: PadButton | null }>();
    let dragger: number | null = null;
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
    };
    const onDown = (e: PointerEvent) => {
      // (the pad is the barn's: not over an overlay)
      const p = at(e), pad = this.held() && this.layers === 'all' && this.ui.screen === 'none' ? padAt(p.x, p.y) : null;
      down.set(e.pointerId, { ...p, camX: this.camX, camY: this.camY, drag: false, pad });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
      if (pad) { this.padHeld.set(e.pointerId, pad); if (PAD_DIR[pad]) this.steer(); return; }
      // (over an overlay the barn's camera stays where the player left it: taps only)
      if (dragger == null && this.ui.screen === 'none') { dragger = e.pointerId; this.camTo = null; this.camAsked = null; }
    };
    const onMove = (e: PointerEvent) => {
      const d = down.get(e.pointerId);
      if (!d || (d.pad && PAD_DIR[d.pad])) return;
      const p = at(e);
      if (!d.drag && Math.hypot(p.x - d.x, p.y - d.y) > DRAG_PX) d.drag = true;
      if (d.drag && dragger === e.pointerId && this.ui.screen === 'none') { this.setCam(d.camX - (p.x - d.x), d.camY - (p.y - d.y)); this.followPause = FOLLOW_PAUSE; }
    };
    const end = (e: PointerEvent, tap: boolean) => {
      const d = down.get(e.pointerId);
      down.delete(e.pointerId);
      if (dragger === e.pointerId) dragger = null;
      if (!d) return;
      if (this.padHeld.delete(e.pointerId) && d.pad && PAD_DIR[d.pad]) { this.steer(); return; }
      if (tap && !d.drag) { const p = at(e); this.tap(p.x, p.y); }
    };
    const onUp = (e: PointerEvent) => end(e, true);
    const onCancel = (e: PointerEvent) => end(e, false);
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
