// Ambient globals. A plain script-scoped .d.ts (no top-level import/export), so this merges with the DOM's Window.

interface Window {
  /**
   * Debug surface installed by the inline script in index.html before the module graph loads. A headless
   * harness (tools/*.ts) polls `ready` and asserts `errors` is empty; anything else a tool needs to drive
   * the page goes on here too, declared by the module that installs it.
   */
  __dragonCare?: {
    ready: boolean;
    errors: string[];
    /**
     * view=floor (src/gallery.ts): per look and anim, the deepest row below the ground line that anything the
     * dragon draws reaches (ground shadow excluded; 1 = the sole's own anti-aliased ink row), and where.
     */
    floor?: { id: string; anim: string; depth: number; frame: number }[];
    /**
     * view=roots (src/gallery.ts): per look and anim, the least depth (px) either far leg's sunk root disc keeps
     * inside the rest of the silhouette drawn over it, and where; `floats` = under the audit's minimum (1.2 hard
     * rule: roots sunk into the body).
     */
    roots?: { id: string; anim: string; depth: number; frame: number; leg: string; floats: boolean }[];
    /**
     * view=tails (src/gallery.ts): per look and core anim, the most its tail's inked top rises over the back's at the
     * hip, px, and where; `gated` = a tip shape (the fluke) held to the audit's ceiling, `high` = over it (3.0).
     */
    tails?: { id: string; anim: string; over: number; frame: number; gated: boolean; high: boolean }[];
    /**
     * view=pour (src/gallery.ts): per look, its breath's effect component that reaches the floor with the highest top
     * (screen row) against the lip line (the mouth's row + POUR_LIP), and where; `column` = it reaches the lip line (3.8).
     */
    pour?: { id: string; frame: number; top: number; lip: number; column: boolean }[];
    /** view=neutral (src/gallery.ts): per look, the share of its pixels that are neutral (HSV S < 0.25); `over` > 40 % (3.1). */
    neutral?: { id: string; share: number; over: boolean }[];
    /** view=missionart (src/game/missionart.ts): the sheet shown and every item it drew (ART_BIBLE 5.10's mission art kit). */
    missionart?: { sheet: string; drawn: string[] };
    /**
     * view=careaudit (src/gallery.ts): per care act and look, the most pixels of the dragon's eye box the keeper covers
     * (K7: never any), where, how far a stroking hand lands from its mark, and whether the act finished.
     */
    care?: { act: string; id: string; covered: number; frame: number; phase: string; miss: number; done: boolean; frames: number }[];
    /**
     * view=base (src/game/base.ts), as of the last frame drawn: the care simulation's step, the camera, the open jobs,
     * the jobs done and the Rushes so far, and the job strip's chips (canvas px) for tapping; the world's digest (the
     * 8-hex FNV-1a hash of src/game/save.ts worldKey: the save's JSON less the seed) and every dragon (its stable id,
     * element, stage, floor and x; what its body is doing, sim.ts DragonMove; the kind of room at its floor and x, or
     * null in the lift bay and the ladder bay; its slot as `kind:index`, or null); the Dragon Lift's car (y, its rider's
     * feet, and the rider's dragon id or null); and the px the dragons have walked in all. Time (BASE_DESIGN 7): the barn's
     * digest (`barnDigest`: the hash of save.ts barnKey, the dragons, keepers, jobs and lift with every absolute clock
     * left out, so two worlds started at different hours but stepped alike agree on it), the clock as the view reads it
     * (day 1-based, hour, minute, the day's phase), the speed (world steps a frame: 0 paused, 1, 2, 4 or 8), whether
     * the page loads and saves the player's barn (`persist`), and the top bar's buttons (canvas px, by name: `new`,
     * `pause`, `speed`). Growing up and eggs (BASE_DESIGN 7): each dragon's `waiting` (it has a job no keeper is at work on yet:
     * a tap on it Rushes that job, where a tap on one not waiting opens its card) and `head` (the middle of its head in
     * canvas px as last drawn, or null when it was not drawn: off screen); the eggs in the Hatchery's nests (each one's
     * element, its nest 0-2 and how far on it is, 0 laid to 1 due); and the name of the dragon whose card is open, or
     * null, with the card's rect (`cardBox`, canvas px: on the far side of the screen from the dragon tapped unless a head is
     * under it there and none on the near side, hud.ts cardAt; null while no card is open). The elder garden (BASE_DESIGN 3): each dragon's `place` (`barn`, or retired, `garden`), and the garden's residents, its
     * plots (one a resident or a retiree, at least two) and the world's walkable width out to its end (world px: 1688
     * with two plots, 176 more a plot). Night you can see (BASE_DESIGN 7): `night`, the night's step the building's walls and
     * shell and the garden were drawn at (0 their day colours, 3 their moonlit night colours, 1 and 2 the stepped mixes
     * of dusk and dawn: src/game/sky.ts lightsOf `walls`).
     * Taking a keeper (BASE_DESIGN 4.10): each keeper (name, floor, x, phase -- sim.ts Phase,
     * 'manual' while held by hand and free, a mission's phases on a trip -- what they carry, and their tap box in canvas
     * px), the keeper held by hand
     * (or taken at work, finishing it first) by name or null, the keepers' badges in the top bar (canvas px, by name: a
     * tap takes that keeper or lets go of the one held), the touch pad's buttons (canvas px, by name: `up`, `left`,
     * `right`, `down`, `act`, `letgo`; published always, drawn and live only while a keeper is held and the barn is on
     * screen: never over an overlay), the line under the pad (who is held, what they carry and what E does) or
     * null (null over an overlay too) and its ink strip (canvas px) or null, and the jobs done by hand so far,
     * by keeper name. The keeper held counts takes and releases still waiting for the next world step in the line and
     * the badges, but not in `controlled` (the simulation's).
     * Missions (BASE_DESIGN 5): a dragon's place may be `away` (with a team out: not drawn); the coin the missions have brought
     * home; the Map Room's board (each mission's id, region, title, difficulty, challenges, baddie or null, days and
     * coin); the trip out, or null (its state -- muster, depart, away, return -- its mission's title and region, its
     * outcome and egg (rolled when it was sent), its pairs by dragon and keeper id, the clocks it left and lands at, and
     * how far along the road it is, 0..1).
     * The overlays (`ui`, BASE_DESIGN 5 and 6): the screen open -- `none` (the barn), `map` or `mission` (the Map Room table's
     * world map or a mission's chooser: the world waits while one is open) or `watch` (the team out watched on its
     * road, the world stepping on underneath) -- the mission chosen (id) and the team being put together, the map's
     * pins (canvas px, board order) and the named buttons on screen (canvas px: `back`, `best`, `send`, and `chip`, the
     * TEAM OUT chip while a team is out and the barn is on screen; over the watch overlay `log`, which opens the trip's
     * log), and `chip` (the TEAM OUT chip's rect while it shows) and `back` (BACK TO BARN's while watching), and
     * whether the trip's log is open over the watch overlay (`log`); and the chooser's line about the egg (`notice`:
     * `HATCHERY FULL: NO EGG`, `BARN FULL: THE EGG WILL WAIT` at the barn's cap, or null -- null too on any other screen).
     * The watchable scene (BASE_DESIGN 6): `scene`, while a trip is out (null
     * otherwise): the last stop the team reached (`foes`, `baddie` or its challenge; null before the first), whether it
     * was met, whether its beat is playing, the banner, the boss on the road (its id, face and pose; null when none is in
     * view) and its health bar (0..1 while its fight is on, else null), how many foes are in view and how many bolts and
     * missiles are in flight, how far along the trip is (0..1), and once its time is up, the result card's title (the
     * trip's pass or fail: nothing before it tells which).
     * Barn capacity (BASE_DESIGN 4.7): the barn's dragons against its cap (`count`: every dragon not living in the garden,
     * those away on a mission too -- life.ts barnCount -- and `cap`, life.ts BARN_CAP; a preset may hold more than the
     * cap). The toast showing, if any (`toast`, its text).
     * Gone once the base is detached (the page left it).
     */
    base?: { tick: number; camX: number; camY: number; jobs: number; done: number; rushes: number; preempted: number;
      chips: { x: number; y: number; w: number; h: number; dragon: string; need: string; rushed: boolean }[];
      digest: string;
      dragons: { id: number; name: string; element: string; stage: string; place: 'barn' | 'garden' | 'away'; f: number; x: number; move: string; room: string | null; slot: string | null;
        waiting: boolean; head: { x: number; y: number } | null }[];
      lift: { y: number; rider: number | null };
      walked: number;
      barnDigest: string;
      clock: { day: number; hour: number; minute: number; phase: 'dawn' | 'day' | 'dusk' | 'night' };
      night: number;
      speed: number;
      persist: boolean;
      buttons: Record<string, { x: number; y: number; w: number; h: number }>;
      eggs: { element: string; nest: number; progress: number }[];
      card: string | null;
      cardBox: { x: number; y: number; w: number; h: number } | null;
      garden: { residents: number; plots: number; worldW: number };
      keepers: { name: string; f: number; x: number; phase: string; carrying: string | null; box: { x: number; y: number; w: number; h: number } }[];
      controlled: string | null;
      badges: Record<string, { x: number; y: number; w: number; h: number }>;
      pad: Record<string, { x: number; y: number; w: number; h: number }>;
      action: string | null;
      line: { x: number; y: number; w: number; h: number } | null;
      doneBy: Record<string, number>;
      coin: number;
      board: { id: number; region: string; title: string; difficulty: string; challenges: string[]; baddie: string | null; days: number; coin: number }[];
      trip: { state: string; mission: string; region: string; success: boolean; egg: string | null; pairs: { dragon: number; keeper: number }[];
        departAt: number | null; returnAt: number | null; progress: number } | null;
      ui: { screen: 'none' | 'map' | 'mission' | 'watch'; mission: number | null; pairs: { dragon: number; keeper: number }[];
        pins: { x: number; y: number; w: number; h: number }[]; buttons: Record<string, { x: number; y: number; w: number; h: number }>;
        chip: { x: number; y: number; w: number; h: number } | null; back: { x: number; y: number; w: number; h: number } | null; log: boolean;
        notice: 'HATCHERY FULL: NO EGG' | 'BARN FULL: THE EGG WILL WAIT' | null };
      scene: { stop: string | null; covered: boolean | null; beat: boolean; banner: string | null;
        baddie: 'bridgetroll' | 'moleking' | 'briarboar' | 'stormroc' | 'frostgiant' | 'cindergolem' | null;
        face: 'fierce' | 'hurt' | 'dazed' | null; pose: 'walk' | 'stand' | 'attack' | 'hit' | 'down' | 'flee' | null; bar: number | null;
        foes: number; shots: number; progress: number; done: boolean; result: string | null } | null;
      barn: { count: number; cap: number };
      /** The toast showing now, if any (its text). */
      toast: string | null };
    /**
     * view=base, live and saving (src/game/base.ts attach, only when the page loads and saves the player's barn): save
     * the barn now, and return the step it was saved at. Gone once the base is detached.
     */
    baseSaveNow?: () => number;
  };
}

interface Window {
  /**
   * Safari still ships the prefixed WebAudio constructors; src/lib/audio/facade.ts falls back to them. The
   * engine declares these in its own types/globals.d.ts, which is outside the src/ tree the subtree vendors,
   * so every consuming game declares them again.
   */
  webkitAudioContext?: typeof AudioContext;
  webkitOfflineAudioContext?: typeof OfflineAudioContext;
}
